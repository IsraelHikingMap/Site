package com.mapeak.car;

import androidx.annotation.NonNull;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Interceptor;
import okhttp3.MediaType;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class SliceProtocolInterceptor implements Interceptor {

    private static final int ONLINE_TIMEOUT_MS = 60_000;
    private static final int ONLINE_TIMEOUT_OFFLINE_AVAILABLE_MS = 2_000;

    private final PmTilesService pmTilesService;

    SliceProtocolInterceptor(PmTilesService pmTilesService) {
        this.pmTilesService = pmTilesService;
    }

    @NonNull
    @Override
    public Response intercept(@NonNull Chain chain) throws IOException {
        Request original = chain.request();

        if (!"slice".equals(original.url().queryParameter("use"))) {
            return chain.proceed(original);
        }

        String url = original.url().toString();
        String[] parts = url.split("/");
        String type = parts[parts.length - 4];
        int z = Integer.parseInt(parts[parts.length - 3]);
        int x = Integer.parseInt(parts[parts.length - 2]);
        int y = Integer.parseInt(parts[parts.length - 1].split("\\.")[0]);

        boolean offlineAvailable = pmTilesService.isOfflineFileAvailable(z, x, y, type);
        int timeout = offlineAvailable ? ONLINE_TIMEOUT_OFFLINE_AVAILABLE_MS : ONLINE_TIMEOUT_MS;

        Chain timeoutChain = chain
                .withConnectTimeout(timeout, TimeUnit.MILLISECONDS)
                .withReadTimeout(timeout, TimeUnit.MILLISECONDS);

        Response response = null;
        IOException networkError = null;
        try {
            response = timeoutChain.proceed(original);
            if (response.isSuccessful()) {
                return response;
            }
        } catch (IOException ex) {
            networkError = ex;
        }

        // Close the failed response body to avoid leaks
        if (response != null) {
            response.close();
        }

        if (!offlineAvailable) {
            if (networkError != null) {
                throw networkError;
            }
            throw new IOException("Failed to get " + url
                    + (response != null ? ": HTTP " + response.code() : ""));
        }

        // Fallback to PMTiles
        byte[] data = pmTilesService.getTileByType(z, x, y, type);
        return new Response.Builder()
                .request(original)
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(ResponseBody.create(data, MediaType.get("application/x-protobuf")))
                .build();
    }
}
