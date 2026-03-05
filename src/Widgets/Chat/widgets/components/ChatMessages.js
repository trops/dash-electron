/**
 * ChatMessages
 *
 * Scrollable message list that auto-scrolls to the bottom on new messages.
 */
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";

export const ChatMessages = ({ messages, streamingRequestId, streamingText }) => {
    const scrollRef = useRef(null);

    // Auto-scroll to bottom when messages change or during streaming
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingText]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                <div className="text-center space-y-1">
                    <div className="text-2xl">&#x1f4ac;</div>
                    <div>Send a message to start chatting</div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scroll-smooth"
        >
            {messages.map((message, index) => {
                const isLastAssistant =
                    message.role === "assistant" &&
                    index === messages.length - 1;
                const isStreaming =
                    isLastAssistant && streamingRequestId !== null;

                return (
                    <MessageBubble
                        key={message.id || index}
                        message={message}
                        isStreaming={isStreaming}
                        streamingText={isStreaming ? streamingText : ""}
                    />
                );
            })}
        </div>
    );
};
