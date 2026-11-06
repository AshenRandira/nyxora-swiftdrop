package com.nyxora.swiftdrop.ai_assistant_service.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nyxora.swiftdrop.ai_assistant_service.exception.GeminiServiceException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class GeminiClient {

    private static final Logger log =
            LoggerFactory.getLogger(GeminiClient.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public GeminiClient(
            @Value("${gemini.api.key:}") String apiKey,
            @Value("${gemini.model:gemini-3.5-flash-lite}") String model,
            @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta}")
            String baseUrl,
            ObjectMapper objectMapper) {

        this.apiKey = apiKey;
        this.model = model;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();

        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(30000);

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();

        log.info("Gemini client initialized. Model: {}", model);
    }

    public String generateContent(String prompt) {

        if (apiKey == null || apiKey.isBlank()
                || "your_gemini_api_key_here".equalsIgnoreCase(apiKey)) {

            log.error("Gemini API key is not configured");

            throw new GeminiServiceException(
                    "AI provider is not configured"
            );
        }

        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException(
                    "Prompt must not be empty"
            );
        }

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of(
                                "role", "user",
                                "parts", List.of(
                                        Map.of("text", prompt)
                                )
                        )
                )
        );

        try {
            String rawResponse = restClient.post()
                    .uri("/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            return extractTextFromResponse(rawResponse);

        } catch (RestClientResponseException ex) {

            // Do not log provider response bodies or secrets.
            log.error(
                    "Gemini API returned HTTP status {}",
                    ex.getStatusCode().value()
            );

            throw new GeminiServiceException(
                    "AI provider request failed"
            );

        } catch (RestClientException ex) {

            log.error(
                    "Gemini API communication failed: {}",
                    ex.getClass().getSimpleName()
            );

            throw new GeminiServiceException(
                    "AI provider is temporarily unavailable"
            );
        }
    }

    private String extractTextFromResponse(String jsonResponse) {

        if (jsonResponse == null || jsonResponse.isBlank()) {
            throw new GeminiServiceException(
                    "AI provider returned an empty response"
            );
        }

        try {
            JsonNode root = objectMapper.readTree(jsonResponse);

            JsonNode candidates = root.path("candidates");

            if (!candidates.isArray() || candidates.isEmpty()) {
                throw new GeminiServiceException(
                        "AI provider returned no usable response"
                );
            }

            JsonNode parts = candidates.get(0)
                    .path("content")
                    .path("parts");

            if (!parts.isArray() || parts.isEmpty()) {
                throw new GeminiServiceException(
                        "AI provider returned no text content"
                );
            }

            StringBuilder result = new StringBuilder();

            for (JsonNode part : parts) {

                JsonNode textNode = part.path("text");

                if (textNode.isTextual()) {
                    result.append(textNode.asText());
                }
            }

            String response = result.toString().trim();

            if (response.isEmpty()) {
                throw new GeminiServiceException(
                        "AI provider returned no text content"
                );
            }

            return response;

        } catch (IOException ex) {

            log.error("Unable to parse Gemini response");

            throw new GeminiServiceException(
                    "AI provider returned an invalid response"
            );
        }
    }

    public String getModel() {
        return model;
    }
}