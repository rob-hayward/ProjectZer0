Node types:
UserNode
BeliefNode
EvidenceNode
ReasearchProposalNode
ActionProposalNode

1. I want the universe/world to be a better place for everyone and everything to live.I believe that a great many other people want that. 
Do you share my belief? Yes/No

“””
? = question mark/ = Boolean
“””



2.“A better world” many mean many slightly (and sometimes greatly) different things from one lifeform to another 




Allow every word to be voted upon…. Is that mental? Maybe not.what would a group editor looklike?Co



node credit is annonymous/private by default but you can show name/credit if you wish. Your contributions/score will be kept privately 


popularity of an idea is more important than the popularity of the person who came up with the idea.


Create a set of BASE_TAGS Only added to by voting:
StatementOfBelief: "I believe..."
StatementOfAssumption: "We assume.."
IndividualNeed: "I need..."
CollectiveNeed: "everybody needs..."
CollectiveWant: "Everybody want..."
IndividualWant: "I want..."
evidence:

<!-- add tags here -->


Belief and word node structure and function:
ok, before we continue with our implementation let me describe some of the final effect that we are looking for, at least for a couple of the nodes. Let's look at the flow from their creation to their display and function.

Belief node.

The user is on their dashboard and chooses the create-new-node button.

They are asked what type of node they would like to create and presented with a list of options (not all node types will be available for selection in this way). Let's imagine the user selects the belief type node. They are then present with a form:

Belief node.

Tags: enter any key word tags for this node here. key word tags will also be auto generated based on the content of your belief statement.

Belief statement: "I believe... (to be completed by user)"

Begin discussion on this topic: "Add your creator comment here to start the discussion"

Creator credit: Would you like to be credited with the creation of this node publicly by displaying your username, or do you prefer to create anonymously? 

Create-node button.

When the create-node button is clicked, the node ID along with the belief statement text is sent to ProjectZer0AI, our FastAPI app which sends it via hugging face to keybert and returns a list of keyword tags based on the content of the belief statement. 

When we receive back this list of words to our backend we add any words that the user manually added to the keyword tags form section of the list and then send all of them to the free dictionary API to fetch a definition for each of the words. I have a rough implementation of this pasted at the bottom.

We then create the following nodes to be displayed as:

Belief node:

We create the belief node to display it's type: "belief", the list of the keyword tags (both the ones generated automatically by keybert and any manually added by the user), The belief statement (within the belief statement any words that are keyword tags in this or any other node sitewide should be highlighted and available as clickable links to their associated word nodes), The credit (either username or anonymous), The positive and negative vote counts (we assume 1 positive vote from the creator), positive and negative vote buttons, the discussion thread, starting with the pinned node creator comment, buttons to up or downvote comments, button to add comments.

Word nodes:

For each of the key word tags in the list: IF a word node does not already exist for that keyword, then we need to create a new word node for that keyword.

Each word node will display: the word, the definition of the word that has the most votes, a list of the other definitions that have been proposed for this word, along with their vote counts, a button for each definition so the user can use their (1 vote per word) vote to pick their favourite definition, a discussion thread for users to discuss with word and definitions.

