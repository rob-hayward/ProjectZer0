// src/lib/stores/discussionStore.ts
import { writable, derived, get } from 'svelte/store';
import { fetchWithAuth } from '$lib/services/api';
import { userStore } from '$lib/stores/userStore';
import { getNeo4jNumber } from '$lib/utils/neo4j-utils';
import { discussionService } from '$lib/services/discussionService';

export type CommentSortMode = 'popularity' | 'newest' | 'oldest';

// Vote data interface
export interface VoteData {
    positiveVotes: number;
    negativeVotes: number;
    netVotes: number;
    shouldBeHidden: boolean;
}

// Comment interface
export interface Comment {
    id: string;
    commentText: string;
    createdBy: string;
    createdAt: string;
    updatedAt?: string;
    parentCommentId?: string;
    positiveVotes: number;
    negativeVotes: number;
    publicCredit?: boolean;
    childComments?: Comment[];
    isVisible?: boolean;
    isExpanded?: boolean;
    depth?: number;
}

// Discussion interface
export interface Discussion {
    id: string;
    createdBy: string;
    createdAt: string;
    associatedNodeId: string;
    associatedNodeType: string;
    visibilityStatus?: boolean;
}

// Discussion store state
interface DiscussionState {
    isLoaded: boolean;
    isLoading: boolean;
    discussion: Discussion | null;
    comments: Comment[];
    rootComments: Comment[];
    sortMode: CommentSortMode;
    error: string | null;
    voteCache: Map<string, VoteData>;
    userVotes: Record<string, 'agree' | 'disagree' | 'none'>;
    isAddingComment: boolean;
    isAddingReply: boolean;
    replyToCommentId: string | null;
    visibilityPreferences: Record<string, boolean>;
}

// Create the discussion store
function createDiscussionStore() {
    const initialState: DiscussionState = {
        isLoaded: false,
        isLoading: false,
        discussion: null,
        comments: [],
        rootComments: [],
        sortMode: 'popularity',
        error: null,
        voteCache: new Map(),
        userVotes: {},
        isAddingComment: false,
        isAddingReply: false,
        replyToCommentId: null,
        visibilityPreferences: {}
    };

    const { subscribe, set, update } = writable<DiscussionState>(initialState);

    // Helper function to build comment tree
    function buildCommentTree(comments: Comment[]): { roots: Comment[], all: Comment[] } {
        const commentMap = new Map<string, Comment>();
        
        // First pass: Create a map of all comments
        comments.forEach(comment => {
            // Create a deep copy of the comment to avoid mutation issues
            const commentCopy = { ...comment, childComments: [], depth: 0 };
            commentMap.set(comment.id, commentCopy);
        });
        
        const rootComments: Comment[] = [];
        const allComments: Comment[] = [];
        
        // Second pass: Build the tree structure
        commentMap.forEach(comment => {
            allComments.push(comment);
            
            if (!comment.parentCommentId) {
                // This is a root comment (directly attached to the discussion)
                rootComments.push(comment);
            } else {
                // This is a reply to another comment
                const parent = commentMap.get(comment.parentCommentId);
                if (parent) {
                    if (!parent.childComments) {
                        parent.childComments = [];
                    }
                    
                    // Set depth based on parent's depth
                    comment.depth = (parent.depth || 0) + 1;
                    
                    // Add to parent's child comments
                    parent.childComments.push(comment);
                } else {
                    // Parent not found, treat as root comment
                    rootComments.push(comment);
                }
            }
        });
        
        // Sort according to current mode (further sorting will be done in the sortComments function)
        return { roots: rootComments, all: allComments };
    }
    
    // Helper function to sort comments
    function sortComments(comments: Comment[], sortMode: CommentSortMode): Comment[] {
        // Sort the comments array
        const sorted = [...comments].sort((a, b) => {
            if (sortMode === 'newest') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } 
            else if (sortMode === 'oldest') {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
            else {
                // Default to 'popularity'
                const aVotes = getNeo4jNumber(a.positiveVotes) - getNeo4jNumber(a.negativeVotes);
                const bVotes = getNeo4jNumber(b.positiveVotes) - getNeo4jNumber(b.negativeVotes);
                return bVotes - aVotes;
            }
        });
        
        // Recursively sort child comments
        sorted.forEach(comment => {
            if (comment.childComments && comment.childComments.length > 0) {
                comment.childComments = sortComments(comment.childComments, sortMode);
            }
        });
        
        return sorted;
    }
    
    // Helper function to calculate vote data
    function calculateVoteData(comment: Comment): VoteData {
        const positiveVotes = getNeo4jNumber(comment.positiveVotes);
        const negativeVotes = getNeo4jNumber(comment.negativeVotes);
        const netVotes = positiveVotes - negativeVotes;
        const shouldBeHidden = netVotes < 0; // Threshold for hiding comments
        
        return {
            positiveVotes,
            negativeVotes,
            netVotes,
            shouldBeHidden
        };
    }
    
    // Helper function to cache vote data
    function cacheVoteData(commentId: string, voteData: VoteData): void {
        update(state => {
            state.voteCache.set(commentId, voteData);
            return state;
        });
    }

    return {
        subscribe,
        
        // Load a discussion and its comments
        async loadDiscussion(nodeType: string, nodeId: string, sortMode: CommentSortMode = 'popularity', nodeText?: string): Promise<void> {
            update(state => ({ ...state, isLoading: true, error: null }));
            
            try {
                // Use discussionService to handle different API patterns
                const discussion = await discussionService.getDiscussion(nodeType, nodeId, nodeText);
                
                if (!discussion) {
                    throw new Error('Discussion not found');
                }
                
                // Fetch comments with the specified sort mode, using discussionService
                const comments = await discussionService.getComments(nodeType, nodeId, sortMode, nodeText);
                
                const processedComments = Array.isArray(comments) ? comments : [];
                
                // Process vote data for each comment
                const userVotes: Record<string, 'agree' | 'disagree' | 'none'> = {};
                processedComments.forEach(comment => {
                    // Calculate and cache vote data
                    const voteData = calculateVoteData(comment);
                    cacheVoteData(comment.id, voteData);
                    
                    // Default to no vote
                    userVotes[comment.id] = 'none';
                });
                
                // Build the comment tree and sort comments
                const { roots, all } = buildCommentTree(processedComments);
                const sortedRoots = sortComments(roots, sortMode);
                
                // Fetch user vote status for all comments
                const currentUser = get(userStore);
                if (currentUser) {
                    try {
                        const votesResponse = await fetchWithAuth(`/users/comments/votes`);
                        if (votesResponse && votesResponse.votes) {
                            // Update user votes based on response
                            // Use proper type casting to ensure we're setting valid vote types
                            Object.entries(votesResponse.votes).forEach(([commentId, status]) => {
                                const voteStatus = status as string;
                                if (voteStatus === 'agree' || voteStatus === 'disagree' || voteStatus === 'none') {
                                    userVotes[commentId] = voteStatus;
                                } else {
                                    // Default to 'none' for invalid values
                                    userVotes[commentId] = 'none';
                                }
                            });
                        }
                    } catch (error) {
                        console.error('Error fetching user votes:', error);
                    }
                }
                
                update(state => ({
                    ...state,
                    isLoaded: true,
                    isLoading: false,
                    discussion,
                    comments: all,
                    rootComments: sortedRoots,
                    sortMode,
                    userVotes
                }));
                
            } catch (error) {
                console.error('Error loading discussion:', error);
                update(state => ({ 
                    ...state, 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to load discussion'
                }));
            }
        },
        
        // Change the sort mode
        setSortMode(mode: CommentSortMode): void {
            update(state => {
                const sortedRoots = sortComments(state.rootComments, mode);
                return {
                    ...state,
                    sortMode: mode,
                    rootComments: sortedRoots
                };
            });
        },
        
        // Get vote data for a comment
        getVoteData(commentId: string): VoteData {
            const state = get({ subscribe });
            
            // Check cache first
            if (state.voteCache.has(commentId)) {
                return state.voteCache.get(commentId)!;
            }
            
            // Find comment in the array
            const comment = state.comments.find(c => c.id === commentId);
            if (!comment) {
                return {
                    positiveVotes: 0,
                    negativeVotes: 0,
                    netVotes: 0,
                    shouldBeHidden: false
                };
            }
            
            // Calculate vote data and cache it
            const voteData = calculateVoteData(comment);
            cacheVoteData(commentId, voteData);
            return voteData;
        },
        
        // Get user's vote status for a comment
        getUserVoteStatus(commentId: string): 'agree' | 'disagree' | 'none' {
            const state = get({ subscribe });
            return state.userVotes[commentId] || 'none';
        },
        
        /**
         * Enhanced addComment method
         */
        async addComment(nodeType: string, nodeId: string, commentText: string, parentCommentId?: string, nodeText?: string): Promise<Comment | null> {
            const currentUser = get(userStore);
            if (!currentUser) return null;
            
            update(state => ({ 
                ...state, 
                isAddingComment: !parentCommentId,
                isAddingReply: !!parentCommentId,
                replyToCommentId: parentCommentId || null
            }));
            
            try {
                // Use discussionService to handle different API patterns
                const response = await discussionService.addComment(
                    nodeType, 
                    nodeId, 
                    commentText, 
                    parentCommentId, 
                    nodeText
                );
                
                if (!response || !response.id) {
                    throw new Error('Failed to create comment');
                }
                
                console.log('[DiscussionStore] Comment created successfully:', response.id);
                
                // Create new comment object
                const newComment: Comment = {
                    ...response,
                    childComments: [],
                    isVisible: true,
                    isExpanded: false, // Start collapsed for better layout
                    depth: parentCommentId ? 1 : 0 // Temporary depth, will be corrected in buildCommentTree
                };
                
                // Calculate and cache vote data for the new comment
                const voteData = calculateVoteData(newComment);
                cacheVoteData(newComment.id, voteData);
                
                // Update store with new comment
                update(state => {
                    // Add comment to the array
                    const updatedComments = [...state.comments, newComment];
                    
                    // Rebuild comment tree
                    const { roots, all } = buildCommentTree(updatedComments);
                    const sortedRoots = sortComments(roots, state.sortMode);
                    
                    // Set user vote status to none for the new comment
                    const updatedUserVotes = {
                        ...state.userVotes,
                        [newComment.id]: 'none' as const
                    };
                    
                    return {
                        ...state,
                        comments: all,
                        rootComments: sortedRoots,
                        userVotes: updatedUserVotes,
                        isAddingComment: false,
                        isAddingReply: false,
                        replyToCommentId: null
                    };
                });
                
                // Dispatch an event for new comment created to help with positioning
                if (typeof window !== 'undefined') {
                    console.log('[DiscussionStore] Dispatching comment-created event:', {
                        commentId: newComment.id,
                        parentId: parentCommentId,
                        isReply: !!parentCommentId
                    });
                    
                    window.dispatchEvent(new CustomEvent('comment-created', { 
                        detail: { 
                            commentId: newComment.id,
                            parentId: parentCommentId,
                            isReply: !!parentCommentId
                        }
                    }));
                }
                
                return newComment;
            } catch (error) {
                console.error('[DiscussionStore] Error adding comment:', error);
                
                update(state => ({ 
                    ...state, 
                    isAddingComment: false,
                    isAddingReply: false,
                    replyToCommentId: null,
                    error: error instanceof Error ? error.message : 'Failed to add comment'
                }));
                
                return null;
            }
        },
        
        // Vote on a comment
        async voteOnComment(commentId: string, voteType: 'agree' | 'disagree' | 'none'): Promise<boolean> {
            const currentUser = get(userStore);
            if (!currentUser) return false;
            
            const state = get({ subscribe });
            const comment = state.comments.find(c => c.id === commentId);
            
            if (!comment) return false;
            
            try {
                let result;
                
                if (voteType === 'none') {
                    // Remove vote
                    result = await discussionService.removeVote(commentId);
                } else {
                    // Add/update vote
                    result = await discussionService.voteOnComment(commentId, voteType === 'agree');
                }
                
                if (!result) {
                    throw new Error('Failed to update vote');
                }
                
                // Update comment with new vote counts
                update(state => {
                    // Find the comment in the array
                    const commentIndex = state.comments.findIndex(c => c.id === commentId);
                    if (commentIndex === -1) return state;
                    
                    // Create updated comment with new vote counts
                    const updatedComment = {
                        ...state.comments[commentIndex],
                        positiveVotes: getNeo4jNumber(result.positiveVotes),
                        negativeVotes: getNeo4jNumber(result.negativeVotes)
                    };
                    
                    // Calculate and cache new vote data
                    const voteData = calculateVoteData(updatedComment);
                    state.voteCache.set(commentId, voteData);
                    
                    // Update user vote status with proper type assertion
                    const updatedUserVotes = {
                        ...state.userVotes,
                        [commentId]: voteType
                    };
                    
                    // Create new comments array with updated comment
                    const updatedComments = [...state.comments];
                    updatedComments[commentIndex] = updatedComment;
                    
                    // Rebuild comment tree
                    const { roots, all } = buildCommentTree(updatedComments);
                    const sortedRoots = sortComments(roots, state.sortMode);
                    
                    return {
                        ...state,
                        comments: all,
                        rootComments: sortedRoots,
                        userVotes: updatedUserVotes
                    };
                });
                
                return true;
                
            } catch (error) {
                console.error('Error voting on comment:', error);
                update(state => ({ 
                    ...state, 
                    error: error instanceof Error ? error.message : 'Failed to update vote'
                }));
                return false;
            }
        },
        
        // Set visibility preference for a comment
        setVisibilityPreference(commentId: string, isVisible: boolean): void {
            update(state => {
                const updatedPreferences = {
                    ...state.visibilityPreferences,
                    [commentId]: isVisible
                };
                
                return {
                    ...state,
                    visibilityPreferences: updatedPreferences
                };
            });
        },
        
        // Check if a comment should be visible based on community standards and user preferences
        shouldBeVisible(commentId: string): boolean {
            const state = get({ subscribe });
            
            // Check user preference first
            if (commentId in state.visibilityPreferences) {
                return state.visibilityPreferences[commentId];
            }
            
            // Get vote data
            const voteData = this.getVoteData(commentId);
            
            // Default to community standard
            return !voteData.shouldBeHidden;
        },
        
     // startReply method
    startReply(commentId: string): void {
        console.log(`[FORM_DEBUG] Discussion store - Starting reply to comment: ${commentId}`);
        
        // Find the comment to ensure it exists
        const state = get({ subscribe });
        const comment = state.comments.find(c => c.id === commentId);
        
        if (!comment) {
            console.warn(`[FORM_DEBUG] Discussion store - Cannot start reply - comment ${commentId} not found`);
            return;
        }
        
        console.log(`[FORM_DEBUG] Discussion store - Found comment for reply:`, {
            id: comment.id,
            text: comment.commentText?.substring(0, 20) + '...'
        });
        
        update(state => {
            console.log(`[FORM_DEBUG] Discussion store - Updating state, previous isAddingReply:`, 
                        state.isAddingReply, 'previous replyToCommentId:', state.replyToCommentId);
            
            const newState = {
                ...state,
                isAddingReply: true,
                replyToCommentId: commentId
            };
            
            console.log(`[FORM_DEBUG] Discussion store - New state:`, 
                        'isAddingReply:', newState.isAddingReply, 
                        'replyToCommentId:', newState.replyToCommentId);
            
            return newState;
        });
        
        // Dispatch an event to notify the GraphManager
        if (typeof window !== 'undefined') {
            console.log(`[FORM_DEBUG] Discussion store - Dispatching discussion-reply-started event`);
            window.dispatchEvent(new CustomEvent('discussion-reply-started', { 
                detail: { commentId }
            }));
        }
    },
        
        // Cancel adding a comment or reply
        cancelAddingComment(): void {
            update(state => ({
                ...state,
                isAddingComment: false,
                isAddingReply: false,
                replyToCommentId: null
            }));
        },
        
        // Reset the store
        reset(): void {
            set(initialState);
        }
    };
}

export const discussionStore = createDiscussionStore();