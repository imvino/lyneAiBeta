// app/api/chat/route.js
import { AzureKeyCredential, OpenAIClient } from '@azure/openai';
import axios from 'axios';
import { NextResponse } from 'next/server';

const openAiClient = new OpenAIClient(
    process.env.AZURE_OPENAI_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
);

function sanitizeSearchQuery(query) {
    let sanitized = query.replace(/[?!]/g, '');
    sanitized = sanitized.trim().replace(/\s+/g, ' ');
    return sanitized;
}

async function performAzureSearch(query) {
    try {
        const sanitizedQuery = sanitizeSearchQuery(query);
        const searchBody = {
            count: true,
            search: sanitizedQuery,
            top: 1,
            select: 'content',
            queryType: 'simple'
        };

        const searchResponse = await axios.post(
            `${process.env.AZURE_SEARCH_SERVICE_ENDPOINT}/indexes/${process.env.AZURE_SEARCH_INDEX_NAME}/docs/search?api-version=2021-04-30-Preview`,
            searchBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': process.env.AZURE_SEARCH_ADMIN_KEY
                }
            }
        );

        return {
            success: true,
            data: searchResponse.data.value
        };
    } catch (error) {
        console.error('Azure Search error:', {
            message: error.message,
            response: error.response?.data
        });

        return {
            success: false,
            error: error
        };
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { messages } = body;
        const userMessage = messages[messages.length - 1]?.content;

        if (!userMessage) {
            return NextResponse.json({
                content: 'I couldn\'t process your message. Please try again.',
                role: 'assistant'
            }, { status: 400 });
        }

        // First try Azure Search
        const searchResult = await performAzureSearch(userMessage);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            const content = searchResult.data[0].content;

            if (content) {
                // console.log('Found content in Azure Search, using for response');

                // Use the full conversation history but enhance system message with knowledge base
                const enhancedMessages = messages.map((msg, index) => {
                    if (index === 0 && msg.role === 'system') {
                        return {
                            ...msg,
                            content: `${msg.content} Keep responses under 200 words and be concise for a small chat interface.
                            
                            Knowledge Base Content:
                            ${content}`
                        };
                    }
                    return msg;
                });

                const openAiResponse = await openAiClient.getChatCompletions(
                    process.env.AZURE_OPENAI_MODEL_NAME,
                    enhancedMessages,
                    {
                        temperature: 0.7,
                        maxTokens: 500,
                        presencePenalty: 0.6,
                        frequencyPenalty: 0.3
                    }
                );

                return NextResponse.json({
                    content: openAiResponse.choices[0].message?.content,
                    role: 'assistant',
                    source: 'azure-search'
                });
            }
        }

        // If we reach here, either Azure Search failed or found no results
        // console.log('No Azure Search results found, falling back to OpenAI');

        // Add concise instruction to system message for fallback
        const enhancedFallbackMessages = messages.map((msg, index) => {
            if (index === 0 && msg.role === 'system') {
                return {
                    ...msg,
                    content: `${msg.content} Keep responses under 200 words and be concise for a small chat interface.`
                };
            }
            return msg;
        });

        const openAiResponse = await openAiClient.getChatCompletions(
            process.env.AZURE_OPENAI_MODEL_NAME,
            enhancedFallbackMessages,
            {
                temperature: 0.7,
                maxTokens: 500
            }
        );

        return NextResponse.json({
            content: openAiResponse.choices[0].message?.content,
            role: 'assistant',
            source: 'openai-fallback'
        });

    } catch (error) {
        console.error('Handler error:', error);

        // Handle specific token limit errors
        if (error.message && (error.message.includes('token') || error.message.includes('context'))) {
            return NextResponse.json({
                content: 'Your conversation has become too long for me to process effectively. Please start a fresh conversation for better responses. You can do this by clicking the options menu (X button) and selecting \'Start Fresh Conversation\'.',
                role: 'assistant'
            }, { status: 200 }); // Return 200 so the message displays normally
        }

        return NextResponse.json({
            content: 'I\'m having technical difficulties right now. Please try again in a few moments.',
            role: 'assistant'
        }, { status: 500 });
    }
}