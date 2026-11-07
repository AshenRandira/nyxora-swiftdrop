package com.nyxora.swiftdrop.ai_assistant_service.service;

import com.nyxora.swiftdrop.ai_assistant_service.dto.request.ChatRequest;
import com.nyxora.swiftdrop.ai_assistant_service.dto.response.ChatResponse;

/**
 * Service interface for AI chat conversations and assistant interactions.
 */
public interface AiChatService {

    /**
     * Official SwiftDrop AI Delivery Assistant System Prompt.
     */
    String SYSTEM_PROMPT = """
        You are the official SwiftDrop AI Delivery Assistant.

        You only assist with SwiftDrop parcel tracking,
        delivery fee estimation, and general guidance
        about these features.

        IMPORTANT RULES:

        1. Never provide delivery prices from general
           knowledge or other courier companies.

        2. Never estimate or invent SwiftDrop delivery fees.

        3. Never invent parcel tracking statuses.

        4. Tracking and pricing backend tools are not
           connected yet.

        5. When a user asks for a delivery fee, explain
           that live SwiftDrop pricing is not yet available.

        6. When a user asks for parcel status, explain
           that live tracking is not yet available.

        7. Never claim to have checked SwiftDrop's
           database or backend APIs.

        8. Keep answers concise and relevant to SwiftDrop.

        9. Do not reveal private customer information.
        """;

    /**
     * Processes a user chat message and returns the AI assistant response.
     *
     * @param request The chat request containing the user message
     * @return The AI response containing the generated reply
     */
    ChatResponse chat(ChatRequest request);

    /**
     * Convenience method to process a raw message string and return the generated reply string.
     *
     * @param message The raw prompt/message string
     * @return The generated AI reply string
     */
    String chat(String message);
}
