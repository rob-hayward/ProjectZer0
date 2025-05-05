// src/lib/services/discussionService.ts
import { fetchWithAuth } from './api';
import type { Discussion, Comment, CommentSortMode } from '$lib/stores/discussionStore';

/**
 * Service to handle discussion-related API operations
 */
export const discussionService = {
    /**
     * Get a discussion by node type and ID
     */
    async getDiscussion(nodeType: string, nodeId: string): Promise<Discussion | null> {
        try {
            const discussion = await fetchWithAuth(`/nodes/${nodeType}/${nodeId}/discussion`);
            return discussion;
        } catch (error) {
            console.error(`Error fetching discussion for ${nodeType}/${nodeId}:`, error);
            return null;
        }
    },
    
    /**
     * Get comments for a discussion with optional sorting
     */
    async getComments(nodeType: string, nodeId: string, sortBy: CommentSortMode = 'popularity'): Promise<Comment[]> {
        try {
            const comments = await fetchWithAuth(`/nodes/${nodeType}/${nodeId}/comments?sortBy=${sortBy}`);
            return Array.isArray(comments) ? comments : [];
        } catch (error) {
            console.error(`Error fetching comments for ${nodeType}/${nodeId}:`, error);
            return [];
        }
    },
    
    /**
     * Add a comment to a discussion
     */
    async addComment(nodeType: string, nodeId: string, commentText: string, parentCommentId?: string): Promise<Comment | null> {
        try {
            const response = await fetchWithAuth(`/nodes/${nodeType}/${nodeId}/comments`, {
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