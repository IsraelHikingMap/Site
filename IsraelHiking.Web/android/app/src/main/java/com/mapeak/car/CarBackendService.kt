package com.mapeak.car

import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.IOException
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng

/**
 * Thin client over the Mapeak backend so the Android Auto experience can search for places and
 * compute point-to-point routes without going through the web layer. Mirrors the endpoints used by
 * the Angular app (see search-results.provider.ts / routing.provider.ts): all results are delivered
 * back on the main thread so callers can update car screens directly.
 */
class CarBackendService {
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Search for places matching [query] near [center]. Mirrors GET /api/search/{term}. Results are
     * capped to [MAX_RESULTS] so they fit the car SearchTemplate item list. The response read is
     * wrapped in a try/catch because body.string() can throw on a read failure, and an exception
     * thrown out of onResponse would never reach the caller, leaving the screen stuck loading.
     */
    fun search(
            query: String,
            center: LatLng?,
            zoom: Double,
            language: String,
            onResult: (List<CarSearchResult>) -> Unit
    ) {
        val term = query.trim()
        if (term.length <= 2) {
            onResult(emptyList())
            return
        }
        val urlBuilder =
                API_BASE.toHttpUrl()
                        .newBuilder()
                        .addPathSegment("search")
                        .addPathSegment(term)
                        .addQueryParameter("language", language)
                        .addQueryParameter("prefix", "false")
        if (center != null) {
            urlBuilder
                    .addQueryParameter("lat", center.latitude.toString())
                    .addQueryParameter("lng", center.longitude.toString())
                    .addQueryParameter("zoom", zoom.toString())
        }
        val request = Request.Builder().url(urlBuilder.build()).build()
        client.newCall(request)
                .enqueue(
                        object : Callback {
                            override fun onFailure(call: Call, e: IOException) {
                                Log.w(LOG_TAG, "Search failed for '$term'", e)
                                postResult(onResult, emptyList())
                            }

                            override fun onResponse(call: Call, response: Response) {
                                val results =
                                        try {
                                            response.use {
                                                if (it.isSuccessful)
                                                        parseSearchResults(it.body.string())
                                                else emptyList()
                                            }
                                        } catch (e: IOException) {
                                            Log.w(LOG_TAG, "Reading search response failed", e)
                                            emptyList()
                                        }
                                postResult(onResult, results)
                            }
                        }
                )
    }

    /**
     * Compute a route from [from] to [to] using the given [routingType]. Mirrors GET /api/routing.
     * Falls back to a straight line between the two points if the backend call fails so the user
     * always gets a usable destination on the map. The from/to points keep a raw comma between
     * lat/lng, matching the web client's "lat,lng" form.
     */
    fun route(from: LatLng, to: LatLng, routingType: String, onResult: (List<LatLng>) -> Unit) {
        val url =
                API_BASE.toHttpUrl()
                        .newBuilder()
                        .addPathSegment("routing")
                        .addEncodedQueryParameter("from", "${from.latitude},${from.longitude}")
                        .addEncodedQueryParameter("to", "${to.latitude},${to.longitude}")
                        .addQueryParameter("type", routingType)
                        .build()
        val request = Request.Builder().url(url).build()
        client.newCall(request)
                .enqueue(
                        object : Callback {
                            override fun onFailure(call: Call, e: IOException) {
                                Log.w(LOG_TAG, "Routing failed", e)
                                postResult(onResult, listOf(from, to))
                            }

                            override fun onResponse(call: Call, response: Response) {
                                val route =
                                        try {
                                            response.use {
                                                if (it.isSuccessful) parseRoute(it.body.string())
                                                else null
                                            }
                                        } catch (e: IOException) {
                                            Log.w(LOG_TAG, "Reading route response failed", e)
                                            null
                                        }
                                                ?: listOf(from, to)
                                postResult(onResult, route)
                            }
                        }
                )
    }

    /**
     * Fetch turn-by-turn instructions for an existing route by map-matching its [points] to the
     * network. Mirrors POST /api/routing (the map-match action) with the routing [routingType],
     * [language] and the v2 instructions format as query parameters and the points as the JSON body.
     * Returns an empty list (so the caller can keep its locally-synthesized turns) if the call fails
     * or carries no instructions.
     */
    fun mapMatch(
            points: List<LatLng>,
            routingType: String,
            language: String,
            onResult: (List<CarManeuver>) -> Unit
    ) {
        if (points.size < 2) {
            onResult(emptyList())
            return
        }
        val url =
                API_BASE.toHttpUrl()
                        .newBuilder()
                        .addPathSegment("routing")
                        .addQueryParameter("type", routingType)
                        .addQueryParameter("language", language)
                        .addQueryParameter("instructionsFormat", "v2")
                        .build()
        val body =
                JSONArray().apply {
                    points.forEach { point ->
                        put(JSONObject().put("lat", point.latitude).put("lng", point.longitude))
                    }
                }
        val request =
                Request.Builder()
                        .url(url)
                        .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
                        .build()
        client.newCall(request)
                .enqueue(
                        object : Callback {
                            override fun onFailure(call: Call, e: IOException) {
                                Log.w(LOG_TAG, "Map match failed", e)
                                postResult(onResult, emptyList())
                            }

                            override fun onResponse(call: Call, response: Response) {
                                val maneuvers =
                                        try {
                                            response.use {
                                                if (it.isSuccessful)
                                                        parseManeuvers(it.body.string())
                                                else emptyList()
                                            }
                                        } catch (e: IOException) {
                                            Log.w(LOG_TAG, "Reading map match response failed", e)
                                            emptyList()
                                        }
                                postResult(onResult, maneuvers)
                            }
                        }
                )
    }

    private fun parseSearchResults(body: String): List<CarSearchResult> {
        if (body.isEmpty()) return emptyList()
        return try {
            val array = JSONArray(body)
            val results = ArrayList<CarSearchResult>()
            var i = 0
            while (i < array.length() && results.size < MAX_RESULTS) {
                val item = array.optJSONObject(i)
                val location = item?.optJSONObject("location")
                if (item != null && location != null) {
                    val title = item.optString("displayName").ifEmpty { item.optString("title") }
                    results.add(
                            CarSearchResult(
                                    title = title,
                                    subtitle = item.optString("description"),
                                    location =
                                            LatLng(
                                                    location.optDouble("lat"),
                                                    location.optDouble("lng")
                                            )
                            )
                    )
                }
                i++
            }
            results
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Could not parse search results", e)
            emptyList()
        }
    }

    private fun parseManeuvers(body: String): List<CarManeuver> {
        if (body.isEmpty()) return emptyList()
        return try {
            val features = JSONObject(body).optJSONArray("features") ?: return emptyList()
            val properties = features.optJSONObject(0)?.optJSONObject("properties")
            val instructions = properties?.optJSONArray("instructions") ?: return emptyList()
            CarManeuver.fromInstructions(instructions)
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Could not parse instructions", e)
            emptyList()
        }
    }

    /**
     * Parse the route geometry out of a GeoJSON FeatureCollection response. GeoJSON coordinates are
     * ordered [lng, lat, (alt)], so they are swapped into [LatLng]'s lat/lng order.
     */
    private fun parseRoute(body: String): List<LatLng>? {
        if (body.isEmpty()) return null
        return try {
            val features = JSONObject(body).optJSONArray("features") ?: return null
            val coordinates =
                    features.optJSONObject(0)
                            ?.optJSONObject("geometry")
                            ?.optJSONArray("coordinates")
                            ?: return null
            val points = ArrayList<LatLng>(coordinates.length())
            for (i in 0 until coordinates.length()) {
                val coordinate = coordinates.optJSONArray(i) ?: continue
                points.add(LatLng(coordinate.getDouble(1), coordinate.getDouble(0)))
            }
            points.ifEmpty { null }
        } catch (e: Exception) {
            Log.w(LOG_TAG, "Could not parse route", e)
            null
        }
    }

    private fun <T> postResult(onResult: (T) -> Unit, value: T) {
        mainHandler.post { onResult(value) }
    }

    companion object {
        // Shared per OkHttp guidance: one client (and its thread/connection pools) for all callers.
        private val client = OkHttpClient()
        private const val LOG_TAG = "CarBackendService"
        private const val API_BASE = "https://mapeak.com/api/"
        private const val MAX_RESULTS = 6
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }
}
