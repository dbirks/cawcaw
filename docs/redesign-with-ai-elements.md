# Building a Vercel AI Elements Chat UI (React + Vite + Capacitor)

In this guide, we’ll create a **full-featured chat interface** using Vercel’s **AI Elements** component library on a static React + Vite frontend. The app will have a modern chat UI with scrolling chat bubbles, a text input box, a send button, a microphone (voice input) button, and a tools toggle button. We’ll integrate the **Vercel AI SDK** for streaming AI responses and tool usage, making direct calls to OpenAI’s API from the frontend (suitable for a Capacitor app). We’ll also show how to display the AI’s **tool calls** (calls to your “MCP” servers) in the conversation, expandable for details, and include an optional collapsible “Reasoning” panel to show the AI’s chain-of-thought. Let’s dive in!

## 1. Project Setup and Installation

**Prerequisites:** Make sure you have a React + Vite project set up with **Tailwind CSS** configured, since AI Elements is built on [shadcn/ui (Tailwind + Radix)](https://ui.shadcn.com). You should also install the Vercel AI SDK packages. We’ll be using **PNPM** for package management in this guide.

* **Install Vercel AI SDK**: Add the core SDK and any providers you need (OpenAI, etc). For example: pnpm add ai @ai-sdk/react @ai-sdk/openai. This installs the main AI SDK (ai), the React hooks, and the OpenAI provider.
* **Configure Tailwind & ShadCN:** If not already set up, install Tailwind and initialize shadcn/ui. In a Vite project, you can run pnpm dlx shadcn@latest init and follow prompts to configure the design system. This will create a components.json and integrate shadcn’s utility classes (using CSS variables for theming)[[1]](https://ai-sdk.dev/elements/overview/setup#:~:text=,to%20use%20an%20API%20key)[[2]](https://ai-sdk.dev/elements/overview/setup#:~:text=,obtain%20an%20API%20key%20here). Make sure your Tailwind config content includes the paths to your components (e.g. ./src/\*\*/\*.{js,jsx,ts,tsx}).
* **Install AI Elements components:** Vercel provides a CLI to add AI Elements to your project. Run pnpm dlx ai-elements@latest and choose the components you want (you can select all, or pick individually)[[3]](https://vercel.com/changelog/introducing-ai-elements#:~:text=Getting%20started). The CLI will download each component’s code and place it in your project (by default under src/components/ai-elements/)[[4]](https://ai-sdk.dev/elements/overview/setup#:~:text=code%20and%20any%20needed%20dependencies,to%20your%20project). Because these are copied into your codebase, you have full control to customize them later[[5]](https://ai-sdk.dev/elements/overview/usage#:~:text=,works%20or%20make%20custom%20modifications)[[6]](https://ai-sdk.dev/elements/overview/usage#:~:text=Customization).

**Note:** The AI Elements library is open-source and built on top of shadcn/ui, meaning the components are **fully customizable React components** (not a black-box library)[[7]](https://vercel.com/changelog/introducing-ai-elements#:~:text=AI%20Elements%20is%20a%20new,with%20the%20Vercel%20AI%20SDK)[[8]](https://ai-sdk.dev/elements/overview/usage#:~:text=Once%20an%20AI%20Elements%20component,the%20usage%20feels%20very%20natural). They provide pre-styled UI primitives (chat messages, inputs, etc.) that you can modify as needed. Ensure you’re on a recent Node (18+) and have your OpenAI API key ready. (Optionally, Vercel’s **AI Gateway** could be used to avoid exposing keys, but since this will run in a secure Capacitor environment, we’ll proceed with direct OpenAI calls.)

## 2. UI Layout Overview

Our chat UI will consist of the following elements:

* **Auto-scrolling Conversation Container:** Keeps the latest messages in view (users shouldn’t have to scroll manually)[[9]](https://www.shadcn.io/ai/conversation#:~:text=Chat%20interfaces%20that%20don%27t%20auto,js%20application%E2%80%94stick%20to%20bottom%20included).
* **Message Bubbles:** Distinct styling for user vs assistant messages, with support for text content and special content like code or images.
* **Tool Call Displays:** Special message parts that show when the AI agent calls external tools (your MCP servers). These will be shown in-line with the conversation, collapsible for details.
* **Reasoning Panel (optional):** A collapsible panel showing the AI’s “thinking process” in real-time, for transparency[[10]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects).
* **Prompt Input Toolbar:** An input textarea for the user prompt, with a **Send** button, a **Microphone** button for voice input, and a **Tools** button to toggle available tools. We’ll also include a model picker as an example (optional).

Below, we’ll go through each of these pieces with code and explanations.

## 3. Auto-Scrolling Conversation Container

To ensure new messages always scroll into view, we use the **<Conversation>** component from AI Elements. This component wraps the entire chat thread and automatically sticks to the bottom when new content is added[[9]](https://www.shadcn.io/ai/conversation#:~:text=Chat%20interfaces%20that%20don%27t%20auto,js%20application%E2%80%94stick%20to%20bottom%20included). It also provides a scroll-to-bottom button if the user scrolls up.

**Code:**

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";

function ChatConversation({ children }) {
 return (
 <Conversation className="relative flex-1">
 <ConversationContent>{children /\* messages will go here \*/}</ConversationContent>
 <ConversationScrollButton /> {/\* shows “↓” when not at bottom \*/}
 </Conversation>
 );
}

As shown above, wrap your messages within <ConversationContent>. The <Conversation> uses a stick-to-bottom behavior so that incoming messages will push the scroll down smoothly[[11]](https://www.shadcn.io/ai/conversation#:~:text=%27use%20client%27%3Bimport%20,avatar)[[12]](https://www.shadcn.io/ai/conversation#:~:text=return%20%28%29%20%3D,Conversation%3E%20%29%3B%7D%3Bexport%20default%20Example). The <ConversationScrollButton> is an auto-fading button that appears if the user scrolls up, allowing them to jump back to the latest message[[13]](https://www.shadcn.io/ai/conversation#:~:text=useStickToBottomContext,).

## 4. Message Bubbles for User and Assistant

Each chat message can be rendered with the <Message> component. This provides a container with appropriate styling (padding, background color, rounded corners, etc.) depending on the sender (user or assistant). We specify the sender via the from prop ("user" or "assistant"). Inside a Message, we use <MessageContent> to hold the message’s content, and we can optionally include a <MessageAvatar> to show an avatar or icon for the speaker.

**Code (Rendering messages):**

import { Message, MessageContent, MessageAvatar } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";

{messages.map((msg) => (
 <Message key={msg.id} from={msg.role}>
 <MessageContent>
 {/\* Render text parts of the message \*/}
 {msg.parts
 .filter(part => part.type === "text")
 .map((part, i) => (
 <Response key={`res-${i}`}>{part.text}</Response>
 ))}
 {/\* Tool and other parts will be handled below \*/}
 </MessageContent>

 {/\* Optionally, show an avatar or name \*/}
 {msg.role === "assistant" ? (
 <MessageAvatar name="Assistant" src="/robot-icon.png" />
 ) : (
 <MessageAvatar name="You" src="/user-icon.png" />
 )}
 </Message>
))}

In this snippet, we iterate over an array of messages (assuming you maintain this state via the AI SDK, discussed later). For each message, we create a <Message from={role}>. We render text segments by mapping over message.parts and filtering for type === "text"[[14]](https://vercel.com/changelog/introducing-ai-elements#:~:text=)[[15]](https://ai-sdk.dev/elements/overview/usage#:~:text=%7Bparts.map%28%28part%2C%20i%29%20%3D), wrapping each in a <Response> component. The **<Response>** component is designed to render text (including Markdown) in the chat bubble with proper styling; it even supports Markdown features like bold, lists, code blocks, and LaTeX out-of the box via Remark plugins[[16]](https://www.shadcn.io/ai/tool#:~:text=%27use%20client%27%3Bimport%20,function%20parseIncompleteMarkdown%28text%3A%20string). For example, if the assistant’s message contains Markdown links or code, <Response> will format them appropriately.

We also include <MessageAvatar> as an example to display who sent the message. This is optional, but can improve clarity in a multi-turn conversation. You can style or replace the avatar images as needed (here we used placeholder icons).

**Styling:** The AI Elements message components come with default Tailwind classes. For instance, by default the assistant’s messages might have one background color and the user’s another (utilizing CSS group selectors like .group-[.is-user] to apply different styles)[[17]](https://ai-sdk.dev/elements/overview/usage#:~:text=). Feel free to customize these in the component files if needed.

## 5. Displaying Tool Calls in the Chat

One key feature of our agent is the ability to call external tools (the “MCP servers”). We want the UI to **transparently show these tool calls** – what tool was invoked, with what parameters, and the result – so the user can trust and verify the agent’s actions. *“Tool calls without visibility are sketchy. Users want to see what APIs the AI is hitting and with what parameters, especially when things go wrong.”*[[18]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,AI%20SDK%20in%20JavaScript%20frameworks)

Vercel AI Elements provides a specialized **<Tool>** component for this. It presents each tool invocation as a collapsible block in the chat. The block includes a header (tool name + status), the tool **input** (arguments sent) and the tool **output** (result or error). By default, the content is collapsed – the user can tap the header to expand and see details[[19]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,error%20states%20for%20shadcn%2Fui%20applications)[[20]](https://www.shadcn.io/ai/tool#:~:text=Tool%20execution%20with%20status).

**Code (Rendering tool parts):**

import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

// ... inside MessageContent mapping (continuing from above) ...
{msg.parts.map((part, idx) => {
 if (part.type.startsWith("tool-")) {
 // This is a tool invocation part
 return (
 <Tool key={`tool-${idx}`} defaultOpen={false}>
 <ToolHeader type={part.toolName || part.type} state={part.state} />
 <ToolContent>
 <ToolInput input={part.input} />
 {/\* Only render output when available: \*/}
 {part.state === "output-available" && (
 <ToolOutput
 output={<Response>{String(part.output)}</Response>}
 errorText={part.errorText}
 />
 )}
 </ToolContent>
 </Tool>
 );
 }
 // (text parts handled above; other part types like 'reasoning' would be handled separately)
})}

In the above snippet, for any message part whose type indicates a tool call (e.g. "tool-search" or "tool-calculator"), we render a <Tool> component[[21]](https://www.shadcn.io/ai/tool#:~:text=%3CTool%20key%3D%7Bindex%7D%20defaultOpen%3D%7Btool.state%20%3D%3D%3D%20%22output,ToolInput%20input%3D%7Btool.input%7D). We pass defaultOpen={false} so that the tool details are collapsed initially (the user will see just a one-liner summary). The <ToolHeader> inside shows the tool name and a status indicator based on part.state[[22]](https://www.shadcn.io/ai/tool#:~:text=%3CTool%20key%3D%7Bindex%7D%20defaultOpen%3D%7Btool.state%20%3D%3D%3D%20%22output,ToolInput%20input%3D%7Btool.input%7D). For example, if part.state === "input-streaming" or "input-available", the header might show a loading spinner or text like “Using tool…”. If state is "output-available", the header might indicate success (and we’ll display the result), and if "output-error", it might indicate an error occurred.

Inside <ToolContent>, we use <ToolInput> to display the input parameters that were sent to the tool[[23]](https://www.shadcn.io/ai/tool#:~:text=). This will list the tool’s arguments (for example, a JSON of { city: "London" } if the tool was a weather API). Next, if an output is available, we render a <ToolOutput> with the result. We wrap the output in <Response> to ensure any text (or Markdown) in the tool’s response is nicely formatted[[24]](https://www.shadcn.io/ai/tool#:~:text=match%20at%20L372%20,tool.errorText%7D). The ToolOutput also takes an errorText prop – if the tool call failed, part.errorText can be shown (and the component likely styles it in a red/error text).

**Collapsible Behavior:** The <Tool> component is collapsible; clicking the header will expand or collapse the content. This allows the user to scan the conversation without being overwhelmed by raw JSON, but they can inspect details on demand[[19]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,error%20states%20for%20shadcn%2Fui%20applications)[[20]](https://www.shadcn.io/ai/tool#:~:text=Tool%20execution%20with%20status). You can control the initial state (we keep it closed until a result is ready, or you might choose to auto-open the first tool call). In the example above, defaultOpen is set to false for all tool calls – you could tweak this, e.g., defaultOpen={part.state==='output-error'} to automatically open if a tool errored out, etc.

With this in place, whenever our AI calls a tool, the UI will stream a message containing a tool part. The user will see something like:

**🔧 Tool: search** (if collapsed)

Expanding it will show, for example:

* **Query:** “Latest AI news” (the input)
* **Result:** *...some summary or data...* (the output)

This provides full transparency into the AI’s actions[[18]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,AI%20SDK%20in%20JavaScript%20frameworks), which is crucial for debugging and user trust.

## 6. Collapsible Reasoning Panel (AI “Thinking” Display)

To further enhance transparency, we can display the AI’s **reasoning process** – the step-by-step thoughts it goes through (often hidden from the user) – in a collapsible panel. Vercel’s AI Elements include a <Reasoning> component to make this easy. This component is typically rendered once (not per message, but as a separate panel) and can auto-show when the AI is “thinking” and auto-hide when done[[10][25]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects).

**Use case:** If you’re building an agent that reasons through steps or chain-of-thought (for example, using an OpenAI function-calling agent that plans: Thought -> Tool -> Thought -> Answer), you can capture those intermediate reasoning texts and display them. The <Reasoning> UI will show a “Thinking…” indicator that expands to show the reasoning content streaming live, then collapse once the final answer is ready.

**Code (Reasoning panel):**

import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";

// Suppose we maintain state for reasoning text and whether AI is currently thinking
const [reasoningText, setReasoningText] = useState("");
const [isThinking, setIsThinking] = useState(false);

// In the UI, perhaps above the Conversation:
<Reasoning className="mb-4" isStreaming={isThinking} defaultOpen={false}>
 <ReasoningTrigger /> {/\* This renders a small header with a brain icon or similar \*/}
 <ReasoningContent>{reasoningText}</ReasoningContent>
</Reasoning>

The <ReasoningTrigger> is a toggle button (often showing an icon like a brain and maybe a down-arrow) that when clicked will manually expand/collapse the panel[[26]](https://www.shadcn.io/ai/reasoning#:~:text=%27use%20client%27%3Bimport%20,content%2C%20setContent%5D)[[27]](https://www.shadcn.io/ai/reasoning#:~:text=return%20,%29%3B%7D%3Bexport%20default%20Example). However, <Reasoning> also opens automatically when isStreaming={true} and closes when isStreaming goes false (with a slight delay, configurable)[[10]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects)[[28]](https://www.shadcn.io/ai/reasoning#:~:text=1000%3Bexport%20const%20Reasoning%20%3D%20memo,isStreaming%29). In practice, you would set isThinking to true when the AI starts formulating a solution (e.g., when a user question comes in, before the AI responds) and append the AI’s reasoning steps to reasoningText as they stream. Once the AI final answer is ready, you set isThinking false, and the panel will auto-collapse after a brief delay (by default ~1s)[[29]](https://www.shadcn.io/ai/reasoning#:~:text=isStreaming%3F%3A%20boolean%3B%20%20open%3F%3A%20boolean%3B,false%29%3B%20%20%20%20const)[[30]](https://www.shadcn.io/ai/reasoning#:~:text=when%20streaming%20starts%20and%20ends,isStreaming%20%26%26%20isOpen). The component also tracks how long the AI spent thinking (duration) if needed.

This feature is **optional** but highly useful for debugging and for power-users. It lets users peek “under the hood.” For example, they could see something like a list of steps:

1. *“I need to find out weather, I have a tool for weather.”*
2. *“Calling getWeatherInformation for London…”*
3. *“Tool returned ‘sunny’. Continuing answer.”*

These can be streamed into the ReasoningContent. (You would obtain these strings either from the agent’s thought process if available, or by logging tool calls and decisions.) The reasoning panel complements the tool call display: tool calls show *what* the AI did, while the reasoning panel shows *why/how* it decided to do it.

## 7. Prompt Input with Voice and Tool Toggles

At the bottom of the interface, we have the user prompt input area. The AI Elements library provides a compound component <PromptInput> that includes a multiline, auto-resizing textarea and a toolbar with buttons[[31]](https://www.shadcn.io/ai/prompt-input#:~:text=Auto,js%20projects). It handles convenient UX details: *Enter* key submits, *Shift+Enter* inserts a newline, and it can show a loading status or disabled state on the submit button[[32]](https://www.shadcn.io/ai/prompt-input#:~:text=Auto,js%20projects)[[33]](https://www.shadcn.io/ai/prompt-input#:~:text=handleSubmit%3A%20FormEventHandler,PaperclipIcon%20size%3D%7B16%7D).

We want to extend this input with two features: - A **microphone button** to capture voice input. - A **tools toggle button** to allow the user to select which tools (MCP servers) are enabled for the AI to use.

Let’s construct the input bar with these.

**Code (Prompt input toolbar):**

import { PromptInput, PromptInputTextarea, PromptInputToolbar, PromptInputTools, PromptInputButton, PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { MicIcon, SettingsIcon } from "lucide-react"; // using lucide-react icons (or any icon set)

function ChatInputBar({ onSend, onVoice, disabled }) {
 const [text, setText] = useState("");
 // status could be 'ready', 'submitted', 'streaming', 'error' to control the send button UI
 const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');

 // Handle form submit
 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!text.trim()) return;
 setStatus('submitted');
 onSend(text);
 // (onSend should start the AI call; you can then update status to 'streaming' and back to 'ready')
 setText("");
 };

 return (
 <PromptInput onSubmit={handleSubmit}>
 <PromptInputTextarea
 value={text}
 onChange={(e) => setText(e.target.value)}
 placeholder="Type your message..."
 disabled={status === 'streaming'}
 />
 <PromptInputToolbar>
 <PromptInputTools>
 {/\* Tools toggle button \*/}
 <PromptInputButton
 type="button"
 onClick={() => toggleToolsModal()} // function to open a modal or popover
 >
 <SettingsIcon size={18} />
 </PromptInputButton>
 {/\* Microphone button \*/}
 <PromptInputButton
 type="button"
 onClick={onVoice} // trigger voice input handling
 >
 <MicIcon size={18} />
 </PromptInputButton>
 </PromptInputTools>
 {/\* Submit button (shows a send icon or loading spinner depending on status) \*/}
 <PromptInputSubmit disabled={!text.trim() || status==='streaming'} status={status} />
 </PromptInputToolbar>
 </PromptInput>
 );
}

Let’s break down what we did:

* We wrap everything in <PromptInput> (which is essentially a styled <form> element)[[34]](https://www.shadcn.io/ai/prompt-input#:~:text=2000%29%3B%20%20,PromptInputModelSelectValue). It captures the form submission when the user presses Enter.
* Inside, <PromptInputTextarea> is the text input field (auto-expanding textarea)[[34]](https://www.shadcn.io/ai/prompt-input#:~:text=2000%29%3B%20%20,PromptInputModelSelectValue). We bind it to local state text. This textarea is set up such that pressing Enter with no modifiers will submit (the component’s onKeyDown handles that by calling form.requestSubmit())[[35]](https://www.shadcn.io/ai/prompt-input#:~:text=...props%7D%3A%20PromptInputTextareaProps%29%20%3D,handleKeyDown). We disable the textarea while streaming a response to prevent sending new input mid-response.
* <PromptInputToolbar> holds the bottom row of the input: the left side “tools” and “mic” buttons, and the right side submit button[[36]](https://www.shadcn.io/ai/prompt-input#:~:text=,div%3E%20%20%29%3B%7D%3Bexport%20default%20Example).
* <PromptInputTools> wraps the left-side group of buttons[[37]](https://www.shadcn.io/ai/prompt-input#:~:text=setText%28e.target.value%29,). We add:
* A **Tools toggle button**, using <PromptInputButton>. We gave it a Settings icon (could be any icon, e.g. a toolbox or sliders icon) and an onClick that calls toggleToolsModal(). (We’ll implement the modal below.) This button will let the user configure which tools are enabled.
* A **Mic button**, also a <PromptInputButton> with a microphone icon[[38]](https://www.shadcn.io/ai/prompt-input#:~:text=,PromptInputModelSelectItem%20key%3D%7Bmodel.id%7D%20value%3D%7Bmodel.id). The onClick calls onVoice – this will trigger our voice input flow (explained in the next section).
* On the right side, <PromptInputSubmit> is used for the send button[[39]](https://www.shadcn.io/ai/prompt-input#:~:text=,PromptInputToolbar). This component automatically shows a **Send icon** (paper airplane) when status is "ready", a loading spinner when status is "streaming", a check or X if there's an error, etc., based on the status prop and Tailwind classes. We pass disabled when there's no text or when a response is in progress. The statuses (‘submitted’, ‘streaming’, etc.) help give feedback – in our handleSubmit, we set status='submitted' when user sends a prompt, then likely switch to 'streaming' when the AI response begins streaming, and finally to 'ready' when completed or 'error' if it failed. The PromptInputSubmit component will change its icon accordingly (it’s configured with an internal mapping of status to icon)[[40]](https://www.shadcn.io/ai/prompt-input#:~:text=ChatStatus%20%7D%20from%20%27ai%27%3Bimport%20,onChange%2C%20%20className)[[41]](https://www.shadcn.io/ai/prompt-input#:~:text=visible%3Aring,).

**Tools Selection Modal:** When the user clicks the Tools (settings) button, we need to show a list of available tools (MCP servers) with toggles (on/off). This can be done using a shadcn **Dialog** or **Popover** component. For example, you might use a <Dialog> that opens with checkboxes:

{/\* Somewhere in Chat UI JSX: \*/}
<Dialog open={toolsModalOpen} onOpenChange={setToolsModalOpen}>
 <DialogContent>
 <DialogHeader><DialogTitle>Select Tools</DialogTitle></DialogHeader>
 {availableTools.map(tool => (
 <div key={tool.id} className="flex items-center justify-between py-1">
 <label htmlFor={tool.id} className="text-sm">{tool.name}</label>
 <Checkbox
 id={tool.id}
 checked={enabledTools.includes(tool.id)}
 onCheckedChange={(checked) => handleToggleTool(tool.id, checked)}
 />
 </div>
 ))}
 <DialogFooter><Button onClick={()=>setToolsModalOpen(false)}>Done</Button></DialogFooter>
 </DialogContent>
</Dialog>

In the above pseudo-code, availableTools would be an array of tool definitions (or at least names/IDs). We use a shadcn <Checkbox> component for each, bound to some state (enabledTools list). The user’s selections could be persisted to localStorage so that their preferences persist between sessions.

*Implementation detail:* When the user toggles tools, you need to ensure the AI agent is aware of which tools are enabled. If you’re using OpenAI function calling, this means adjusting the functions you pass in the API request to only include the enabled ones. If you’re using the Vercel AI SDK’s built-in tool system (with useChat and a serverless route), it means only including those tool definitions in the tools object on the server (or filtering out calls client-side if disabled). Since this app is front-end only, one approach is to intercept the agent’s tool call: if a tool is disabled, you could return an error or dummy result to the AI, or better, instruct the AI (via system prompt) not to use certain tools. A simple method is updating a system prompt like “You have the following tools: X, Y” based on the selection.

For now, the UI part is in place – the user can configure the tools. We’ll integrate the logic of using this selection when we discuss the AI agent call.

## 8. Voice Input via OpenAI Transcription (Whisper API)

When the user taps the **microphone button**, we want to capture their speech and convert it to text to send as a prompt. We’ll use OpenAI’s Whisper model via the AI SDK’s **transcription** utility. Vercel’s AI SDK has an experimental transcribe() function that interfaces with transcription models (like Whisper)[[42]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=Transcription%20is%20an%20experimental%20feature)[[43]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=const%20transcript%20%3D%20await%20transcribe%28). OpenAI recently introduced high-accuracy speech-to-text models like gpt-4o-transcribe and a faster gpt-4o-mini-transcribe, which improve word error rate and handle accents/noisy backgrounds better than previous Whisper versions[[44]](https://www.infoq.com/news/2025/03/openai-speech-models/#:~:text=The%20new%20gpt,meeting%20transcriptions%2C%20and%20multilingual%20conversations). We’ll use the **“Mini” model** for speed.

**Recording audio:** In a web context, you can use the Media Devices API (navigator.mediaDevices.getUserMedia) to get microphone input and record it via a MediaRecorder. In Capacitor, you also have plugins to capture audio. The outcome should be an audio Blob or ArrayBuffer of the recording. For simplicity, assume we record a short audio clip and obtain it as a Blob.

**Code (voice recording & transcription):**

import { experimental\_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

async function handleVoiceInput() {
 // 1. Capture audio from microphone (implementation depends on environment)
 const audioBlob = await recordAudioOnce(); // your implementation
 if (!audioBlob) return;
 setStatus('submitted'); // indicate we're processing voice input

 // 2. Read the audio blob as ArrayBuffer
 const audioData = new Uint8Array(await audioBlob.arrayBuffer());

 // 3. Call OpenAI Whisper (transcription) via AI SDK
 const transcript = await transcribe({
 model: openai.transcription('gpt-4o-mini-transcribe'), // use the mini model
 audio: audioData
 });
 console.log("Transcription result:", transcript);
 // 4. Use the transcribed text
 const userMessage = transcript.text?.trim();
 if (userMessage) {
 // e.g., directly send the message or set it into the input field
 sendMessage(userMessage);
 }
 setStatus('ready');
}

Let’s explain this:

* We call our hypothetical recordAudioOnce() function which handles the media recording and returns a Blob of audio (for example, a short WAV or OGG recording of the user’s voice). There are many ways to implement this; you could use the Web Speech API for built-in speech recognition, but here we use the OpenAI route for consistent accuracy.
* We convert the Blob into a Uint8Array of audio data (the AI SDK’s transcribe function accepts Uint8Array, Buffer, ArrayBuffer, etc. as the audio input)[[45]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=).
* We call experimental\_transcribe() from the ai package[[46]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=import%20,from%20%27ai), specifying the OpenAI Whisper model. We use openai.transcription('whisper-1') in general, but here we choose the newer model: openai.transcription("gpt-4o-mini-transcribe"). This tells the SDK to use OpenAI’s GPT-4 Open (4-O) Mini transcription model[[47]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=Provider%20Model%20OpenAI%20%60whisper,v3). This model is faster and was reported to handle varied speech reliably[[44]](https://www.infoq.com/news/2025/03/openai-speech-models/#:~:text=The%20new%20gpt,meeting%20transcriptions%2C%20and%20multilingual%20conversations). (You could also use 'whisper-1' for the standard Whisper or 'gpt-4o-transcribe' for the larger model. Ensure your OpenAI API key has access to these if they’re gated.)
* The result transcript contains transcript.text with the recognized text, plus other info like language and segments if needed[[48]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=,URL).
* We take the text and either automatically send it as a message (sendMessage(userMessage)) or place it into the input field for the user to edit/confirm. In a smooth UX, you might do an interim step: show the transcribed text in the input box for a second for confirmation, or play it back, etc. But often it’s fine to immediately treat it as a message send.
* After sending, reset status and cleanup as appropriate.

With this, your app now supports voice prompts. The user can tap the mic, speak their question, and the text will be sent to the chat, just as if they typed it.

## 9. Integrating the AI Agent (Front-End Calls with Vercel AI SDK)

Now that our UI components are set up, we need to wire up the “brains” behind it: the coding agent that processes user prompts, possibly uses tools, and returns answers. We’ll use the **Vercel AI SDK** to manage the chat state and perform calls to OpenAI’s API.

Since we have **no backend** (all client-side), we’ll call OpenAI’s chat completion API directly from the client. Normally, the Vercel SDK’s useChat hook expects an API route to post to[[49]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=const%20,%3D%20useChat), but we can configure it to call OpenAI ourselves. We have two main options:

**Option A: Use OpenAI’s function calling directly.** We can bypass useChat and use the OpenAI JS SDK or fetch to /v1/chat/completions. In this approach, you maintain the messages state array manually. When sending: - Include a system prompt that defines available tools (functions) based on user selections. - Call the OpenAI API with functions definitions for those tools. - If a function\_call is returned, detect it and handle it: i.e., make the tool’s API call (fetch the MCP server) to get result, then add an assistant message with the function’s result (or have the model call a function that the SDK can capture). - Then continue the conversation (possibly calling OpenAI again with the new messages including the tool result) until you get a final answer.

This is essentially implementing the agent loop on the client. It’s doable, but involves careful orchestration. The Vercel AI SDK can assist by providing types (e.g. FunctionCallHandler), but currently much of their tooling is geared toward Node/Next.js execution of tools.

**Option B: Use useChat with a custom transport.** The useChat React hook manages streaming for you. If we could provide it with a custom send function that calls OpenAI and yields tokens, it would handle updating the messages state and streaming. The SDK’s DefaultChatTransport is meant for calling a Next.js route[[50]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=transport%3A%20new%20DefaultChatTransport%28), which in turn calls streamText on the server. Without a server, one approach is to simulate a minimal streaming fetch: for example, use fetch with the OpenAI-Organization and API key in headers, and stream: true in the request, then read the stream in JS.

For our documentation purpose, we’ll outline a simpler pattern mixing these approaches: - Use useChat for state management (so we get messages and setMessages easily). - When sending a message from the UI, call a custom async function sendMessageWithTools(userInput) instead of the default sendMessage. This function will: 1. Add the user message to the messages list. 2. Call OpenAI’s chat completion with the current conversation, including any **function definitions** for enabled tools. 3. If the response is a tool function call, execute the tool (fetch the MCP server) and then *manually add* a tool result message part to messages (using addMessage or by pushing to state). 4. Possibly call OpenAI again if needed (multi-step) until a final answer is obtained. 5. Add the final assistant answer to messages.

This is essentially writing a mini-agent. The Vercel AI SDK’s agent capabilities on the server do these steps automatically[[51]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=The%20flow%20is%20as%20follows%3A)[[52]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=7.%20Client,another%20iteration%20of%20this%20flow), but on the client we handle them.

**Managing State:** The messages state can be an array of objects with shape like { id, role, content?, parts? }. The Vercel SDK actually uses a UIMessage type where parts contain the segmented content (text vs tool parts). If using useChat, when you call sendMessage({ content: "...", ... }) it would normally POST to API and stream back, building parts. Without that, we might manage it directly.

Given the complexity, you might opt to use a lightweight state management without useChat – but then you lose some conveniences. For brevity, let’s assume you manage an array of messages and update it as events happen. Pseudocode for agent logic:

async function sendMessageWithTools(userText: string) {
 // 1. Append user message to UI
 addMessage({ role: 'user', content: userText });
 // 2. Prepare OpenAI API request
 const functions = enabledTools.map(t => t.functionDef); // define functions JSON for OpenAI if using function calling
 const payload = {
 model: "gpt-4-0613", // or gpt-3.5 with functions
 messages: messages.map(m => m.role === 'assistant' ?
 { role: 'assistant', content: m.content, function\_call: m.function\_call } :
 { role: m.role, content: m.content }),
 functions,
 stream: true
 };
 // 3. Call OpenAI API (streaming fetch)
 const response = await fetch("https://api.openai.com/v1/chat/completions", { ... });
 for await (const chunk of streamChunks(response)) {
 const delta = parseOpenAISSE(chunk);
 if (delta.role) {
 // new assistant message started
 currentAssistantMsg = { id: ..., role: 'assistant', parts: [] };
 addMessage(currentAssistantMsg);
 }
 if (delta.content) {
 // append content token
 currentAssistantMsg.parts.push({ type: 'text', text: delta.content });
 updateMessage(currentAssistantMsg);
 }
 if (delta.function\_call) {
 // assistant is calling a function
 const funcName = delta.function\_call.name;
 currentAssistantMsg.parts.push({ type: `tool-${funcName}`, state: 'input-available', input: JSON.parse(delta.function\_call.arguments) });
 updateMessage(currentAssistantMsg);
 // 4. Execute the tool call if enabled
 if (isToolEnabled(funcName)) {
 try {
 const toolResult = await callToolServer(funcName, JSON.parse(delta.function\_call.arguments));
 // Add tool result to message
 const toolPart = currentAssistantMsg.parts.find(p => p.type.startsWith('tool-') && !p.output);
 toolPart.output = toolResult;
 toolPart.state = 'output-available';
 updateMessage(currentAssistantMsg);
 } catch(err) {
 toolPart.errorText = String(err);
 toolPart.state = 'output-error';
 updateMessage(currentAssistantMsg);
 }
 } else {
 // Tool is disabled, return an error or message saying it's not available
 toolPart.errorText = "Tool disabled by user";
 toolPart.state = 'output-error';
 updateMessage(currentAssistantMsg);
 }
 // Optionally: automatically send the assistant message to OpenAI again, now with the tool result, to get a final answer.
 const followUpResponse = await openAI.chat([...messages, {role: "function", name: funcName, content: toolResultText}]);
 // and so on...
 }
 }
}

The above is **high-level logic** and would need to be adapted, but it illustrates how tool calls can be caught and executed on the fly, and how you’d update the UI messages accordingly (which we already set up to render tool parts and text parts nicely).

**Using useChat**: If this feels like reinventing the wheel, note that the official pattern is to use useChat with a Next.js route that calls streamText which handles all the above for you[[51]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=The%20flow%20is%20as%20follows%3A)[[52]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=7.%20Client,another%20iteration%20of%20this%20flow). In a static app, you trade some convenience for not needing a server. It’s a valid approach as long as you handle your API keys carefully. (In a Capacitor app, the code is not easily inspectable, and you can store the key securely using Capacitor’s Storage APIs if needed.)

**Updating the Reasoning Panel:** As you implement the agent logic, you can update the reasoningText state whenever the AI is thinking or as it sends intermediate thoughts. For example, if you have a chain-of-thought enabled model (some developers include a hidden “thought” content before a function call), you could capture that and append to the reasoning panel. Or simply log that a tool is being used: e.g., set reasoningText = "🤔 AI decided to call the weather API for London\n" before executing, then reasoningText += "✅ Tool result: sunny\n". The Reasoning UI will show this live if isThinking remains true until the final answer is ready.

## 10. Putting It All Together

With all components and logic in place, your React component tree might look like:

function ChatPage() {
 // state: messages, enabledTools, reasoningText, isThinking, etc.
 // event handlers: sendMessageWithTools, handleVoiceInput, toggleTools...

 return (
 <div className="flex flex-col h-full">
 {/\* Reasoning panel at top (optional) \*/}
 <Reasoning …>{/\* Trigger & Content as above \*/}</Reasoning>

 {/\* Conversation messages \*/}
 <ChatConversation>
 {messages.map(msg => (
 <Message from={msg.role} key={msg.id}>
 <MessageContent>
 {msg.parts.map(renderPart)} {/\* renderPart handles text vs tool parts \*/}
 </MessageContent>
 {msg.role === 'assistant' && <MessageAvatar name="Assistant" src="robot.png"/>}
 {msg.role === 'user' && <MessageAvatar name="You" src="user.png"/>}
 </Message>
 ))}
 </ChatConversation>

 {/\* Input toolbar \*/}
 <ChatInputBar onSend={sendMessageWithTools} onVoice={handleVoiceInput} />

 {/\* Tools selection modal (hidden unless toggled) \*/}
 {toolsModalOpen && <ToolsModal … />}
 </div>
 );
}

Style the container (flex flex-col h-full) such that the conversation expands and the input bar stays at the bottom. The Conversation component will handle its own scrolling behavior.

**Local Storage for Tool Preferences:** On mount, you can load saved tool preferences (enabledTools) from localStorage (or Capacitor Storage). On changes, save them. This way, if a user disables a certain tool, the app will remember that next time.

**Testing the Flow:** - Typing a prompt and hitting Enter (or clicking Send) should add a user message and then stream the assistant’s response in real-time, including any function calls. You’ll see tool call placeholders appear and then get filled in with results (the UI parts will update from “Loading…” to final output)[[53]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=switch%20%28part.state%29%20)[[54]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=case%20%27output). - Clicking the mic, speaking a query, should transcribe and then trigger the above as if you typed it. - Toggling the tools: try disabling a tool and asking a question that would normally use it; the agent should either refrain or attempt and get an error (depending on how you program the agent’s prompt/logic). You could, for example, modify the system prompt to list only enabled tools, so the model simply won’t call a disabled one.

**Conclusion:** You now have a **comprehensive AI chat interface** with: - Rich message display (with Markdown, code formatting via <Response>), - Streaming responses, - Voice input (using OpenAI Whisper models for transcription)[[46]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=import%20,from%20%27ai)[[44]](https://www.infoq.com/news/2025/03/openai-speech-models/#:~:text=The%20new%20gpt,meeting%20transcriptions%2C%20and%20multilingual%20conversations), - Tool usage with full transparency (collapsible API call details)[[18]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,AI%20SDK%20in%20JavaScript%20frameworks)[[21]](https://www.shadcn.io/ai/tool#:~:text=%3CTool%20key%3D%7Bindex%7D%20defaultOpen%3D%7Btool.state%20%3D%3D%3D%20%22output,ToolInput%20input%3D%7Btool.input%7D), - A reasoning panel to show the AI’s thought process (for advanced visibility)[[10]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects), - and a clean, mobile-friendly UI thanks to Tailwind and Radix UI components.

All of this runs purely on the frontend (static React + Vite), making OpenAI API calls directly from the client. This is suitable for embedding in a Capacitor app, as we avoid any need for a separate backend. Remember to secure your OpenAI API key (Capacitor’s secure storage, or using Vercel’s AI Gateway with a client token). With this setup, you can further iterate on your agent’s prompts and abilities, and the UI will already support new tools or features you add (just drop in a new tool component or reasoning logic as needed).

**References:**

* Vercel Changelog: *Introducing AI Elements* (Hayden Bleasel, Ryan Haraki) – announcing the AI Elements library[[7]](https://vercel.com/changelog/introducing-ai-elements#:~:text=AI%20Elements%20is%20a%20new,with%20the%20Vercel%20AI%20SDK)[[3]](https://vercel.com/changelog/introducing-ai-elements#:~:text=Getting%20started).
* Vercel AI SDK Docs – *Chatbot Tool Usage* example (showing how tool calls are forwarded and rendered)[[51]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=The%20flow%20is%20as%20follows%3A)[[55]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=case%20%27tool).
* Vercel AI Elements Documentation – usage of Message, Response, PromptInput, Tool, Reasoning components[[15]](https://ai-sdk.dev/elements/overview/usage#:~:text=%7Bparts.map%28%28part%2C%20i%29%20%3D)[[37]](https://www.shadcn.io/ai/prompt-input#:~:text=setText%28e.target.value%29,)[[56]](https://www.shadcn.io/ai/tool#:~:text=%27use%20client%27%3Bimport%20,%5Bemail%20protected)[[10]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects).
* InfoQ News (2025) – *OpenAI Introduces New Speech Models* – details on gpt-4o-transcribe and gpt-4o-mini-transcribe improvements[[44]](https://www.infoq.com/news/2025/03/openai-speech-models/#:~:text=The%20new%20gpt,meeting%20transcriptions%2C%20and%20multilingual%20conversations). These models can be accessed via the OpenAI API for transcription, as we utilized with experimental\_transcribe[[46]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=import%20,from%20%27ai)[[47]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=Provider%20Model%20OpenAI%20%60whisper,v3).

[[1]](https://ai-sdk.dev/elements/overview/setup#:~:text=,to%20use%20an%20API%20key) [[2]](https://ai-sdk.dev/elements/overview/setup#:~:text=,obtain%20an%20API%20key%20here) [[4]](https://ai-sdk.dev/elements/overview/setup#:~:text=code%20and%20any%20needed%20dependencies,to%20your%20project) Introduction: Setup

<https://ai-sdk.dev/elements/overview/setup>

[[3]](https://vercel.com/changelog/introducing-ai-elements#:~:text=Getting%20started) [[7]](https://vercel.com/changelog/introducing-ai-elements#:~:text=AI%20Elements%20is%20a%20new,with%20the%20Vercel%20AI%20SDK) [[14]](https://vercel.com/changelog/introducing-ai-elements#:~:text=) Introducing AI Elements: Prebuilt, composable AI SDK components - Vercel

<https://vercel.com/changelog/introducing-ai-elements>

[[5]](https://ai-sdk.dev/elements/overview/usage#:~:text=,works%20or%20make%20custom%20modifications) [[6]](https://ai-sdk.dev/elements/overview/usage#:~:text=Customization) [[8]](https://ai-sdk.dev/elements/overview/usage#:~:text=Once%20an%20AI%20Elements%20component,the%20usage%20feels%20very%20natural) [[15]](https://ai-sdk.dev/elements/overview/usage#:~:text=%7Bparts.map%28%28part%2C%20i%29%20%3D) [[17]](https://ai-sdk.dev/elements/overview/usage#:~:text=) Introduction: Usage

<https://ai-sdk.dev/elements/overview/usage>

[[9]](https://www.shadcn.io/ai/conversation#:~:text=Chat%20interfaces%20that%20don%27t%20auto,js%20application%E2%80%94stick%20to%20bottom%20included) [[11]](https://www.shadcn.io/ai/conversation#:~:text=%27use%20client%27%3Bimport%20,avatar) [[12]](https://www.shadcn.io/ai/conversation#:~:text=return%20%28%29%20%3D,Conversation%3E%20%29%3B%7D%3Bexport%20default%20Example) [[13]](https://www.shadcn.io/ai/conversation#:~:text=useStickToBottomContext,) React AI Conversation - shadcn.io

<https://www.shadcn.io/ai/conversation>

[[10]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects) [[25]](https://www.shadcn.io/ai/reasoning#:~:text=Collapsible%20reasoning%20display%20for%20AI,js%20projects) [[26]](https://www.shadcn.io/ai/reasoning#:~:text=%27use%20client%27%3Bimport%20,content%2C%20setContent%5D) [[27]](https://www.shadcn.io/ai/reasoning#:~:text=return%20,%29%3B%7D%3Bexport%20default%20Example) [[28]](https://www.shadcn.io/ai/reasoning#:~:text=1000%3Bexport%20const%20Reasoning%20%3D%20memo,isStreaming%29) [[29]](https://www.shadcn.io/ai/reasoning#:~:text=isStreaming%3F%3A%20boolean%3B%20%20open%3F%3A%20boolean%3B,false%29%3B%20%20%20%20const) [[30]](https://www.shadcn.io/ai/reasoning#:~:text=when%20streaming%20starts%20and%20ends,isStreaming%20%26%26%20isOpen) React AI Reasoning - shadcn.io

<https://www.shadcn.io/ai/reasoning>

[[16]](https://www.shadcn.io/ai/tool#:~:text=%27use%20client%27%3Bimport%20,function%20parseIncompleteMarkdown%28text%3A%20string) [[18]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,AI%20SDK%20in%20JavaScript%20frameworks) [[19]](https://www.shadcn.io/ai/tool#:~:text=Collapsible%20tool%20execution%20display%20with,error%20states%20for%20shadcn%2Fui%20applications) [[20]](https://www.shadcn.io/ai/tool#:~:text=Tool%20execution%20with%20status) [[21]](https://www.shadcn.io/ai/tool#:~:text=%3CTool%20key%3D%7Bindex%7D%20defaultOpen%3D%7Btool.state%20%3D%3D%3D%20%22output,ToolInput%20input%3D%7Btool.input%7D) [[22]](https://www.shadcn.io/ai/tool#:~:text=%3CTool%20key%3D%7Bindex%7D%20defaultOpen%3D%7Btool.state%20%3D%3D%3D%20%22output,ToolInput%20input%3D%7Btool.input%7D) [[23]](https://www.shadcn.io/ai/tool#:~:text=) [[24]](https://www.shadcn.io/ai/tool#:~:text=match%20at%20L372%20,tool.errorText%7D) [[56]](https://www.shadcn.io/ai/tool#:~:text=%27use%20client%27%3Bimport%20,%5Bemail%20protected) React AI Tool - shadcn.io

<https://www.shadcn.io/ai/tool>

[[31]](https://www.shadcn.io/ai/prompt-input#:~:text=Auto,js%20projects) [[32]](https://www.shadcn.io/ai/prompt-input#:~:text=Auto,js%20projects) [[33]](https://www.shadcn.io/ai/prompt-input#:~:text=handleSubmit%3A%20FormEventHandler,PaperclipIcon%20size%3D%7B16%7D) [[34]](https://www.shadcn.io/ai/prompt-input#:~:text=2000%29%3B%20%20,PromptInputModelSelectValue) [[35]](https://www.shadcn.io/ai/prompt-input#:~:text=...props%7D%3A%20PromptInputTextareaProps%29%20%3D,handleKeyDown) [[36]](https://www.shadcn.io/ai/prompt-input#:~:text=,div%3E%20%20%29%3B%7D%3Bexport%20default%20Example) [[37]](https://www.shadcn.io/ai/prompt-input#:~:text=setText%28e.target.value%29,) [[38]](https://www.shadcn.io/ai/prompt-input#:~:text=,PromptInputModelSelectItem%20key%3D%7Bmodel.id%7D%20value%3D%7Bmodel.id) [[39]](https://www.shadcn.io/ai/prompt-input#:~:text=,PromptInputToolbar) [[40]](https://www.shadcn.io/ai/prompt-input#:~:text=ChatStatus%20%7D%20from%20%27ai%27%3Bimport%20,onChange%2C%20%20className) [[41]](https://www.shadcn.io/ai/prompt-input#:~:text=visible%3Aring,) React AI Prompt Input - shadcn.io

<https://www.shadcn.io/ai/prompt-input>

[[42]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=Transcription%20is%20an%20experimental%20feature) [[43]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=const%20transcript%20%3D%20await%20transcribe%28) [[45]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=) [[46]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=import%20,from%20%27ai) [[47]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=Provider%20Model%20OpenAI%20%60whisper,v3) [[48]](https://ai-sdk.dev/docs/ai-sdk-core/transcription#:~:text=,URL) AI SDK Core: Transcription

<https://ai-sdk.dev/docs/ai-sdk-core/transcription>

[[44]](https://www.infoq.com/news/2025/03/openai-speech-models/#:~:text=The%20new%20gpt,meeting%20transcriptions%2C%20and%20multilingual%20conversations) OpenAI Introduces New Speech Models for Transcription and Voice Generation - InfoQ

<https://www.infoq.com/news/2025/03/openai-speech-models/>

[[49]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=const%20,%3D%20useChat) [[50]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=transport%3A%20new%20DefaultChatTransport%28) [[51]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=The%20flow%20is%20as%20follows%3A) [[52]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=7.%20Client,another%20iteration%20of%20this%20flow) [[53]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=switch%20%28part.state%29%20) [[54]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=case%20%27output) [[55]](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage#:~:text=case%20%27tool) AI SDK UI: Chatbot Tool Usage

<https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage>
