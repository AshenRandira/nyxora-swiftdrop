package com.nyxora.swiftdrop.auth.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties metadata for third-party OAuth providers (Google, Apple, Facebook).
 * Eliminates IDE 'Unknown property' warnings and provides type-safe property binding.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app")
public class OAuthProperties {

    private Google google = new Google();
    private Apple apple = new Apple();
    private Facebook facebook = new Facebook();

    @Getter
    @Setter
    public static class Google {
        /**
         * Google OAuth 2.0 Web Client ID registered in Google Cloud Console.
         */
        private String clientId = "mock-google-client-id.apps.googleusercontent.com";

        /**
         * Enables sandbox demo mode for testing without requiring live Google credentials.
         */
        private boolean mockEnabled = true;
    }

    @Getter
    @Setter
    public static class Apple {
        /**
         * Apple Sign In Services ID registered in Apple Developer Console.
         */
        private String clientId = "mock-apple-client-id";

        /**
         * Enables sandbox demo mode for testing without requiring a paid Apple Developer subscription.
         */
        private boolean mockEnabled = true;
    }

    @Getter
    @Setter
    public static class Facebook {
        /**
         * Facebook App ID registered in Meta for Developers portal.
         */
        private String appId = "mock-facebook-app-id";

        /**
         * Facebook App Secret used for HMAC-SHA256 appsecret_proof token verification.
         */
        private String appSecret = "mock-facebook-app-secret";
    }
}
