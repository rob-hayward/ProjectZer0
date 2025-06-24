// src/lib/services/discussionService.ts - ENHANCED DEBUG VERSION
import { fetchWithAuth } from './api';
import type { Discussion, Comment, CommentSortMode } from '$lib/stores/discussionStore';
import { getNodeDiscussionEndpoint, getNodeCommentsEndpoint, getNodeDataEndpoint } from './navigation';

/**
 * Service to handle discussion-related API operations
 */
export const discussionService = {
    /**
     * Get a discussion by node type and ID
     */
    async getDiscussion(nodeType: string, nodeId: string, nodeText?: string): Promise<Discussion | null> {
        try {
            // Use the utility function to get the correct endpoint
            const endpoint = getNodeDiscussionEndpoint(nodeType, nodeId, nodeText);
            
            if (!endpoint) {
                throw new Error(`Unable to determine discussion endpoint for ${nodeType} node`);
            }
            
            const discussion = await fetchWithAuth(endpoint);
            return discussion;
        } catch (error) {
            console.error(`Error fetching discussion for ${nodeType}/${nodeId}:`, error);
            return null;
        }
    },
    
    /**
     * Get comments for a discussion with optional sorting
     */
    async getComments(nodeType: string, nodeId: string, sortBy: CommentSortMode = 'popularity', nodeText?: string): Promise<Comment[]> {
        try {
            // Use the utility function to get the correct endpoint
            const endpoint = getNodeCommentsEndpoint(nodeType, nodeId, nodeText);
            
            if (!endpoint) {
                throw new Error(`Unable to determine comments endpoint for ${nodeType} node`);
            }
            
            const response = await fetchWithAuth(`${endpoint}?sortBy=${sortBy}`);
            
            // Check if response is an object with a comments property
            if (response && response.comments && Array.isArray(response.comments)) {
                return response.comments;
            }
            
            // Check if response itself is an array
            if (Array.isArray(response)) {
                return response;
            }
            
            // Return empty array as fallback
            return [];
        } catch (error) {
            console.error(`Error fetching comments for ${nodeType}/${nodeId}:`, error);
            return [];
        }
    },
    
    /**
     * CRITICAL FIX: Enhanced addComment method with comprehensive debugging
     */
    async addComment(nodeType: string, nodeId: string, commentText: string, parentCommentId?: string, nodeText?: string): Promise<Comment | null> {
        try {
            // Use the utility function to get the correct endpoint
            const endpoint = getNodeCommentsEndpoint(nodeType, nodeId, nodeText);
            
            if (!endpoint) {
                throw new Error(`Unable to determine comments endpoint for ${nodeType} node`);
            }
            
            console.group('[DiscussionService] 🚀 Adding comment - FULL TRACE');
            console.log('Input parameters:', {
                nodeType,
                nodeId,
                commentText: commentText.substring(0, 50) + '...',
                parentCommentId,
                parentCommentType: typeof parentCommentId,
                parentCommentIsNull: parentCommentId === null,
                parentCommentIsUndefined: parentCommentId === undefined,
                nodeText,
                endpoint
            });
            
            // CRITICAL FIX: More explicit request body construction
            const requestBody: Record<string, any> = {
                commentText: commentText.trim()
            };
            
            // CRITICAL: Multiple approaches to ensure parentCommentId is properly included
            if (parentCommentId !== undefined && parentCommentId !== null && parentCommentId !== '') {
                requestBody.parentCommentId = parentCommentId;
                console.log('✅ Including parentCommentId in request body:', requestBody.parentCommentId);
            } else {
                console.log('Received parentCommentId:', { value: parentCommentId, type: typeof parentCommentId });
            }
            
            console.log('📤 Final request body being sent:', JSON.stringify(requestBody, null, 2));
            console.log('📍 Endpoint:', endpoint);
            
            // Make the API call
            const response = await fetchWithAuth(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('📥 Raw API response:', response);
            
            // CRITICAL: Detailed response analysis
            if (response && response.id) {
                console.log('📋 Response analysis:', {
                    id: response.id,
                    commentText: response.commentText?.substring(0, 50) + '...',
                    parentCommentId: response.parentCommentId,
                    parentCommentType: typeof response.parentCommentId,
                    hasParentComment: !!response.parentCommentId,
                    expectedParent: parentCommentId,
                    parentMatch: response.parentCommentId === parentCommentId,
                    createdBy: response.createdBy,
                    createdAt: response.createdAt
                });
                
                // CRITICAL WARNING: Check if parent was lost
                if (parentCommentId && !response.parentCommentId) {
                    console.error('🚨 CRITICAL: Parent comment ID was lost!');
                    console.error('Expected parent:', parentCommentId);
                    console.error('Actual parent in response:', response.parentCommentId);
                    console.error('This indicates a backend issue with storing parentCommentId');
                }
                
                // CRITICAL WARNING: Check if parent was changed
                if (parentCommentId && response.parentCommentId !== parentCommentId) {
                    console.error('🚨 CRITICAL: Parent comment ID changed!');
                    console.error('Expected:', parentCommentId);
                    console.error('Got:', response.parentCommentId);
                }
                
                console.groupEnd();
                return response;
            } else {
                console.error('❌ Invalid response from server');
                console.error('Response:', response);
                console.groupEnd();
                throw new Error('Invalid response from server');
            }
            
        } catch (error) {
            console.error('💥 Error in discussionService.addComment:', error);
            
            // Log the exact error details
            if (error instanceof Error) {
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
            }
            
            // If it's a fetch error, log response details
            if (error && typeof error === 'object' && 'response' in error) {
                console.error('HTTP Response Error:', error);
            }
            
            console.groupEnd();
            return null;
        }
    },
    
    /**
     * Get node data based on node type
     */
    async getNodeData(nodeType: string, nodeId: string, nodeText?: string): Promise<any> {
        try {
            if (nodeType === 'word') {
                // Special handling for word nodes since they require the word text, not ID
                if (nodeText) {
                    // If we have the word text, use it directly
                    return await fetchWithAuth(`/nodes/word/${nodeText}`);
                } else {
                    // If we only have the ID, we need to first fetch all words and find the matching one
                    const allWords = await fetchWithAuth('/nodes/word/all');
                    if (Array.isArray(allWords)) {
                        const wordData = allWords.find(word => word.id === nodeId);
                        if (wordData) {
                            // Now fetch the complete word data using the word text
                            return await fetchWithAuth(`/nodes/word/${wordData.word}`);
                        }
                    }
                    throw new Error(`Word with ID ${nodeId} not found`);
                }
            } else {
                // For other node types, use the standard endpoint
                const endpoint = getNodeDataEndpoint(nodeType, nodeId, nodeText);
                
                if (!endpoint) {
                    throw new Error(`Unable to determine data endpoint for ${nodeType} node`);
                }
                
                return await fetchWithAuth(endpoint);
            }
        } catch (error) {
            console.error(`Error fetching ${nodeType} data:`, error);
            return null;
        }
    },
    
    /**
     * Update a comment
     */
    async updateComment(commentId: string, commentText: string): Promise<Comment | null> {
        try {
            const response = await fetchWithAuth(`/comments/${commentId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    commentText
                })
            });
            
            return response;
        } catch (error) {
            console.error(`Error updating comment ${commentId}:`, error);
            return null;
        }
    },
    
    /**
     * Delete a comment
     */
    async deleteComment(commentId: string): Promise<boolean> {
        try {
            await fetchWithAuth(`/comments/${commentId}`, {
                method: 'DELETE'
            });
            
            return true;
        } catch (error) {
            console.error(`Error deleting comment ${commentId}:`, error);
            return false;
        }
    },
    
    /**
     * Vote on a comment
     */
    async voteOnComment(commentId: string, isPositive: boolean): Promise<any> {
        try {
            const response = await fetchWithAuth(`/comments/${commentId}/vote`, {
                method: 'POST',
                body: JSON.stringify({
                    isPositive
                })
            });
            
            return response;
        } catch (error) {
            console.error(`Error voting on comment ${commentId}:`, error);
            throw error;
        }
    },
    
    /**
     * Remove vote from a comment
     */
    async removeVote(commentId: string): Promise<any> {
        try {
            const response = await fetchWithAuth(`/comments/${commentId}/vote/remove`, {
                method: 'POST'
            });
            
            return response;
        } catch (error) {
            console.error(`Error removing vote from comment ${commentId}:`, error);
            throw error;
        }
    },
    
    /**
     * Get vote status for a comment
     */
    async getVoteStatus(commentId: string): Promise<{ status: 'agree' | 'disagree' | 'none' }> {
        try {
            const response = await fetchWithAuth(`/comments/${commentId}/vote`);
            return response;
        } catch (error) {
            console.error(`Error getting vote status for comment ${commentId}:`, error);
            return { status: 'none' };
        }
    },
    
    /**
     * Set comment visibility
     */
    async setCommentVisibility(commentId: string, isVisible: boolean): Promise<boolean> {
        try {
            await fetchWithAuth(`/comments/${commentId}/visibility`, {
                method: 'PUT',
                body: JSON.stringify({
                    isVisible
                })
            });
            
            return true;
        } catch (error) {
            console.error(`Error setting visibility for comment ${commentId}:`, error);
            return false;
        }
    }
};

export default discussionService;