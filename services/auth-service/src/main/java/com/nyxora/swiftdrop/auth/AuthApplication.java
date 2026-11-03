package com.nyxora.swiftdrop.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * SwiftDrop Authentication & Identity Microservice.
 *
 * Responsibilities:
 * - User Registration & Role Assignment (Customer, Merchant, Courier, Admin)
 * - Credential Verification & BCrypt Hashing
 * - Stateless JWT Access Token & Stateful Refresh Token Lifecycle Management
 * - Google OAuth 2.0 Social Login Integration
 * - Merchant & Courier Approval Workflows
 */
@SpringBootApplication
public class AuthApplication {

    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(AuthApplication.class, args);
    }

    private static void loadDotEnv() {
        Path[] possiblePaths = new Path[]{
                Paths.get(".env"),
                Paths.get("../../.env"),
                Paths.get("../.env")
        };

        for (Path path : possiblePaths) {
            if (Files.isRegularFile(path)) {
                try (BufferedReader reader = Files.newBufferedReader(path)) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                            continue;
                        }
                        int eqIdx = line.indexOf('=');
                        String key = line.substring(0, eqIdx).trim();
                        String val = line.substring(eqIdx + 1).trim();
                        if (val.startsWith("\"") && val.endsWith("\"") && val.length() >= 2) {
                            val = val.substring(1, val.length() - 1);
                        } else if (val.startsWith("'") && val.endsWith("'") && val.length() >= 2) {
                            val = val.substring(1, val.length() - 1);
                        }
                        if (System.getProperty(key) == null && System.getenv(key) == null) {
                            System.setProperty(key, val);
                        }
                    }
                    break;
                } catch (IOException ignored) {
                }
            }
        }
    }
}
