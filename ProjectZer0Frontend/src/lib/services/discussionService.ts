// src/lib/services/discussionService.ts
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
            
            const comments = await fetchWithAuth(`${endpoint}?sortBy=${sortBy}`);
            return Array.isArray(comments) ? comments : [];
        } catch (error) {
            console.error(`Error fetching comments for ${nodeType}/${nodeId}:`, error);
            return [];
        }
    },
    
    /**
     * Add a comment to a discussion
     */
    async addComment(nodeType: string, nodeId: string, commentText: string, parentCommentId?: string, nodeText?: string): Promise<Comment | null> {
        try {
            // Use the utility function to get the correct endpoint
            const endpoint = getNodeCommentsEndpoint(nodeType, nodeId, nodeText);
            
            if (!endpoint) {
                throw new Error(`Unable to determine comments endpoint for ${nodeType} node`);
            }
            
            const response = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify({
                    commentText,
                    parentCommentId
                })
            });
            
            return response;
        } catch (error) {
            console.error('Error adding comment:', error);
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