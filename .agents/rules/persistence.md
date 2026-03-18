---
trigger: always_on
---

# Règle de stockage des artefacts
À partir de maintenant, tu ne dois plus utiliser le répertoire d'artefacts par défaut. 
Tous les fichiers de planification (task.md, implementation_plan.md), la documentation, les notes de recherche et autres artefacts que tu génères doivent IMPÉRATIVEMENT être créés et sauvegardés dans le sous-répertoire `.agents/artefacts` à la racine du workspace actuel.
Si le répertoire `.agent/` n'existe pas, crée-le. Utilise toujours des chemins absolus vers ce répertoire pour écrire tes fichiers (par exemple : `g:\devapps\Ezio\.agents\artefacts\task.md`).


## Knowledge Discovery
 
```
<knowledge_discovery>
# Knowledge Items (KI) System
 
## 🚨 MANDATORY FIRST STEP: Check KI Summaries Before Any Research 🚨
 
**At the start of each conversation, you receive KI summaries with artifact paths.** These summaries exist precisely to help you avoid redundant work.
 
**BEFORE performing ANY research, analysis, or creating documentation, you MUST:**
1. **Review the KI summaries** already provided to you at conversation start
2. **Identify relevant KIs** by checking if any KI titles/summaries match your task
3. **Read relevant KI artifacts** using the artifact paths listed in the summaries BEFORE doing independent research
4. **Build upon KI** by using the information from the KIs to inform your own research
 
## ❌ Example: What NOT to Do
 
DO NOT immediately start fresh research when a relevant KI might already exist:
 
```
USER: Can you analyze the core engine module and document its architecture?
# BAD: Agent starts researching without checking KI summaries first
ASSISTANT: [Immediately calls list_dir and view_file to start fresh analysis]
ASSISTANT: [Creates new 600-line analysis document]
# PROBLEM: A "Core Engine Architecture" KI already existed in the summaries!
```
 
## ✅ Example: Correct Approach
 
ALWAYS check KI summaries first before researching:
 
```
USER: Can you analyze the core engine module and document its architecture?
# GOOD: Agent checks KI summaries first
ASSISTANT: Let me first check the KI summaries for existing analysis.
# From KI summaries: "Core Engine Architecture" with artifact: architecture_overview.md
ASSISTANT: I can see there's already a comprehensive KI on the core engine.
ASSISTANT: [Calls view_file to read the existing architecture_overview.md artifact]
TOOL: [Returns existing analysis]
ASSISTANT: There's already a detailed analysis. Would you like me to enhance it with specific details, or review this existing analysis?
```
 
## When to Use KIs (ALWAYS Check First)
 
**YOU MUST check and use KIs in these scenarios:**
- **Before ANY research or analysis** - FIRST check if a KI already exists on this topic
- **Before creating documentation** - Verify no existing KI covers this to avoid duplication
- **When you see a relevant KI in summaries** - If a KI title matches the request, READ the artifacts FIRST
- **When encountering new concepts** - Search for related KIs to build context
- **When referenced in context** - Retrieve KIs mentioned in conversations or other KIs
 
## Example Scenarios
 
**YOU MUST also check KIs in these scenarios:**
 
### 1. Debugging and Troubleshooting
- **Before debugging unexpected behavior** - Check if there are KIs documenting known bugs or gotchas
- **When experiencing resource issues** (memory, file handles, connection limits) - Check for best practices KIs
- **When config changes don't take effect** - Check for KIs documenting configuration precedence/override mechanisms
- **When utility functions behave unexpectedly** - Check for KIs about known bugs in common utilities
 
**Example:**
```
USER: This function keeps re-executing unexpectedly even after I added guards
# GOOD: Check KI summaries for known bugs or common pitfalls in similar components
# BAD: Immediately start debugging without checking if this is a documented issue
```
 
### 2. Following Architectural Patterns
- **Before designing "new" features** - Check if similar patterns already exist
  - Especially for: system extensions, configuration points, data transformations, async operations
- **When adding to core abstractions** - Check for refactoring patterns (e.g., plugin systems, handler patterns)
- **When implementing common functionality** - Check for established patterns (caching, validation, serialization, authentication)
 
**Example:**
```
USER: Add user preferences to the application
# GOOD: Check for "configuration management" or "user settings" pattern KIs first
# BAD: Design from scratch without checking if there's an established pattern
```
 
### 3. Complex Implementation
- **When planning multi-phase work** - Check for workflow example KIs
- **When uncertain about approach** - Check for similar past implementations documented in KIs
- **Before integrating components** - Check for integration pattern KIs
 
**Example:**
```
USER: I need to add a caching layer between the API and database
# GOOD: Check for "caching patterns" or "data layer integration" KIs first
# BAD: Start implementing without checking if there's an established integration approach
```
 
## Key Principle
 
**If a request sounds "simple" but involves core infrastructure, ALWAYS check KI summaries first.** The simplicity might hide:
- Established implementation patterns
- Known gotchas and edge cases
- Framework-specific conventions
- Previously solved similar problems
 
Common "deceptively simple" requests:
- "Add a field to track X" → Likely has an established pattern for metadata/instrumentation
- "Make this run in the background" → Check async execution patterns
- "Add logging for Y" → Check logging infrastructure and conventions
 
 
## KI Structure
 
Each KI in /Users/XXX/.gemini/antigravity/knowledge contains:
- **metadata.json**: Summary, timestamps, and references to original sources
- **artifacts/**: Related files, documentation, and implementation details
 
## KIs are Starting Points, Not Ground Truth
 
**CRITICAL:** KIs are snapshots from past work. They are valuable starting points, but **NOT** a substitute for independent research and verification.
 
- **Always verify:** Use the references in metadata.json to check original sources
- **Expect gaps:** KIs may not cover all aspects. Supplement with your own investigation
- **Question everything:** Treat KIs as clues that must be verified and supplemented
</knowledge_discovery>
```
 
---
 
## Persistent Context
 
```
<persistent_context>
# Persistent Context
When the USER starts a new conversation, the information provided to you directly about past conversations is minimal, to avoid overloading your context. However, you have the full ability to retrieve relevant information from past conversations as you need it. There are two mechanisms through which you can access relevant context.
1. Conversation Logs and Artifacts, containing the original information in the conversation history
2. Knowledge Items (KIs), containing distilled knowledge on specific topics
 
## Conversation Logs and Artifacts
You can access the original, raw information from past conversations through the corresponding conversation logs, as well as the ASSISTANT-generated artifacts within the conversation, through the filesystem.
 
### When to Use
You should read the conversation logs and when you need the details of the conversation, and there are a small number of relevant conversations to study. Here are some specific example scenarios and how to approach them:
1. When have a new Conversation ID, either from an @mention or from reading another conversation or knowledge item, but only if the information from the conversation is likely to be relevant to the current context.
  - You can access the logs directly if you have the Conversation ID.
2. When the USER explicitly mentions a specific conversation, such as by topic or recentness
  - Try to identify potential relevant conversation(s) from the conversation summaries available to you.
3. When the USER alludes to a specific piece of information that was likely discussed in a previous conversation, but you cannot easily identify the relevant conversation from the summaries available to you.
  - Use file system research tools, such as codebase_search, list_dir, and grep_search, to identify the relevant conversation(s).
 
### When NOT to Use
You should not read the conversation logs if it is likely to be irrelevent to the current conversation, or the conversation logs are likely to contain more information than necessary. Specific example scenarios include:
1. When researching a specific topic
  - Search for relevant KIs first. Only read the conversation logs if there are no relevant KIs. 
2. When the conversation is referenced by a KI or another conversation, and you know from the summary that the conversation is not relevant to the current context.
3. When you read the overview of a conversation (because you decided it could potentially be relevant), and then conclude that the conversation is not actually relevant.
  - At this point you should not read the task logs or artifacts.
 
## Knowledge Items
KIs contain curated knowledge on specific topics. Individual KIs can be updated or expanded over multiple conversations. They are generated by a separate KNOWLEDGE SUBAGENT that reads the conversations and then distills the information into new KIs or updates existing KIs as appropriate.
 
### When to Use
1. When starting any kind of research
2. When a KI appears to cover a topic that is relevant to the current conversation
3. When a KI is referenced by a conversation or another KI, and the title of the KI looks relevant to the current conversation.
 
### When NOT to Use
It is better to err on the side of reading KIs when it is a consideration. However, you should not read KIs on topics unrelated to the current conversation.
 
## Usage Examples
Here are some examples of how the ASSISTANT should use KIs and conversation logs, with comments on lines starting with # to explain the reasoning.
 
### Example 1: Multiple KIs Required
<example>
USER: I need to add a new AI player to my tic-tac-toe game that uses minimax algorithm and follows the existing game architecture patterns.
# The ASSISTANT already has KI summaries available that include artifact paths. No need to search or list directories.
# From the summaries, the ASSISTANT can see multiple KIs:
# - game_architecture_patterns KI with artifacts: architecture_overview.md, implementation_patterns.md, class_diagram.md
# - randomized_ai_implementation KI with artifacts: random_player.md, ai_player_interface.md, testing_strategies.md
# - database_schema KI with artifacts: schema_design.md, migration_guide.md
# - ui_components KI with artifacts: button_styles.md, layout_system.md
# The ASSISTANT should focus only on relevant KIs and their artifacts
ASSISTANT: I can see from the KI summaries that `game_architecture_patterns` and `randomized_ai_implementation` are relevant to implementing an AI player. I'll review the key artifacts from these KIs.
ASSISTANT: [parallel view_file calls to read architecture_overview.md, implementation_patterns.md, ai_player_interface.md from the KI summaries]
TOOL: [File contents are returned]
ASSISTANT: Based on the patterns in these KIs, here's how to implement your AI player...
</example>