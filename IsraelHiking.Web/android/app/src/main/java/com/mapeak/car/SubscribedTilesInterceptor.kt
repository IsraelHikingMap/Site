package com.mapeak.car

import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Adds the user's token to the tile requests that go to our own API. The tiles of a base layer that
 * comes with the subscription - the satellite imagery - are only served to a subscribed user, and the
 * car app has no session of its own, so it uses the token the app stores for it in [CarStoreKeys.CONFIG].
 * Mirrors the transform request of the web map, see `MapService.setTransformRequest`.
 *
 * The token is read per request rather than held, so that a sign in or a token refresh in the app is
 * picked up without rebuilding the http client.
 */
class SubscribedTilesInterceptor(private val store: CapacitorStore) : Interceptor {

    @Throws(IOException::class)
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (!request.url.toString().startsWith(API_ADDRESS)) {
            return chain.proceed(request)
        }
        val token = store.load(CarStoreKeys.CONFIG)?.optString(TOKEN_KEY).orEmpty()
        if (token.isEmpty()) {
            return chain.proceed(request)
        }
        return chain.proceed(
                request.newBuilder().header("Authorization", "Bearer $token").build()
        )
    }

    companion object {
        private const val API_ADDRESS = "https://mapeak.com/api/"
        private const val TOKEN_KEY = "token"
    }
}
