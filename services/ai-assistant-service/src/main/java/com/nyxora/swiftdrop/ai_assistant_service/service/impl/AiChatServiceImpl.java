package com.nyxora.swiftdrop.ai_assistant_service.service.impl;

import com.nyxora.swiftdrop.ai_assistant_service.client.GeminiClient;
import com.nyxora.swiftdrop.ai_assistant_service.dto.request.ChatRequest;
import com.nyxora.swiftdrop.ai_assistant_service.dto.response.ChatResponse;
import com.nyxora.swiftdrop.ai_assistant_service.service.AiChatService;
import com.nyxora.swiftdrop.common.security.util.PiiMaskingUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiChatServiceImpl implements AiChatService {

    private static final Logger log =
            LoggerFactory.getLogger(AiChatServiceImpl.class);

    private final GeminiClient geminiClient;

    public AiChatServiceImpl(GeminiClient geminiClient) {
        this.geminiClient = geminiClient;
    }

    @Override
    public ChatResponse chat(ChatRequest request) {
        String reply = chat(request.message());
        return new ChatResponse(reply);
    }

    @Override
    public String chat(String message) {

        log.info("Processing chat request with message: '{}'",
                PiiMaskingUtil.maskText(message));

        String normalized = message.toLowerCase();

        if (normalized.matches(
                "(?s).*(how much|cost|price|fee|quote).*")) {

            return "I can help calculate SwiftDrop delivery fees, "
                    + "but the pricing service is not connected yet.";
        }

        if (normalized.matches(
                "(?s).*(track|tracking|where is my parcel|delivery status).*")) {

            return "I can help track SwiftDrop parcels, "
                    + "but live tracking is not connected yet.";
        }

        return geminiClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(message)
                .call()
                .content();
    }
}
