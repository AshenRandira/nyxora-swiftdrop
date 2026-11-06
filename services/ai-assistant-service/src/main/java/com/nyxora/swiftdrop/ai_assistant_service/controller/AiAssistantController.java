package com.nyxora.swiftdrop.ai_assistant_service.controller;

import com.nyxora.swiftdrop.ai_assistant_service.client.GeminiClient;
import com.nyxora.swiftdrop.ai_assistant_service.dto.GenerateRequest;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
public class AiAssistantController {

    private final GeminiClient geminiClient;

    public AiAssistantController(GeminiClient geminiClient) {
        this.geminiClient = geminiClient;
    }

    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getInfo() {

        return ResponseEntity.ok(Map.of(
                "service", "ai-assistant-service",
                "status", "UP"
        ));
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, String>> generate(
            @Valid @RequestBody GenerateRequest request) {

        String response =
                geminiClient.generateContent(request.prompt());

        return ResponseEntity.ok(Map.of(
                "response", response,
                "model", geminiClient.getModel()
        ));
    }
}