"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    MdSend,
    MdChat,
    MdAttachFile,
    MdClose,
    MdInsertDriveFile
} from "react-icons/md";

import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";


interface Attachment {
    id:string;
    name:string;
    type:string;
    dataUrl:string;
    size:number;
}


interface Message {
    id:string;
    role:"user"|"assistant";
    content:string;
    attachments?:Attachment[];
    timestamp:Date;
}



const MAX_FILE_SIZE = 10 * 1024 * 1024;



function createId(){

    return globalThis.crypto &&
    "randomUUID" in globalThis.crypto

    ? globalThis.crypto.randomUUID()

    : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

}



function formatBytes(bytes:number){

    if(bytes < 1024 * 1024)
        return `${(bytes/1024).toFixed(1)} KB`;

    return `${(bytes/(1024*1024)).toFixed(1)} MB`;

}


export default function AiChatClient(){

const {user,userProfile,loading}=useAuth();

const router=useRouter();

const pathname=usePathname();



const [messages,setMessages]=useState<Message[]>([]);

const [input,setInput]=useState("");

const [busy,setBusy]=useState(false);

const [pendingAttachments,setPendingAttachments]=useState<Attachment[]>([]);

const [attachError,setAttachError]=useState<string|null>(null);



const [ocrKey,setOcrKey]=useState<string|null>(()=>{

if(typeof window!=="undefined")
return localStorage.getItem("ocr_session_key");

return null;

});


const [sessionId,setSessionId]=useState<string|null>(()=>{

if(typeof window!=="undefined")
return localStorage.getItem("chat_session_id");

return null;

});



const messagesEndRef=useRef<HTMLDivElement>(null);

const textareaRef=useRef<HTMLTextAreaElement>(null);

const fileInputRef=useRef<HTMLInputElement>(null);


useEffect(()=>{

if(ocrKey)
localStorage.setItem("ocr_session_key",ocrKey);

},[ocrKey]);


useEffect(()=>{

if(sessionId)
localStorage.setItem("chat_session_id",sessionId);

},[sessionId]);


useEffect(()=>{

if(!loading && !user){

router.push(
`/auth?next=${encodeURIComponent(pathname || "/ai-chat")}`
);

}

},[loading,user,router,pathname]);


useEffect(()=>{

messagesEndRef.current?.scrollIntoView({
behavior:"smooth"
});

},[messages,busy]);


const firstName =
userProfile?.firstName ||
user?.displayName?.split(" ")[0] ||
"User";



const handleNewChat = async()=>{


setMessages([]);

setInput("");

setPendingAttachments([]);

setSessionId(null);

try{
const res = await fetch("/api/chat-bot",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

key:ocrKey,

question:"new chat",

newChat:true

})

});

const data=await res.json();



if(data.sessionId){

setSessionId(data.sessionId);

}


}catch(err){

console.error(err);

}

};

const handleFileSelect=(files:FileList|null)=>{


if(!files)
return;


setAttachError(null);



for(const file of Array.from(files)){


if(file.size > MAX_FILE_SIZE){

setAttachError(
`${file.name} exceeds 10 MB limit`
);

continue;

}



const reader=new FileReader();



reader.onload=(e)=>{


setPendingAttachments(prev=>[

...prev,

{

id:createId(),

name:file.name,

type:file.type,

dataUrl:e.target?.result as string,

size:file.size

}

]);


};



reader.readAsDataURL(file);

}


if(fileInputRef.current)
fileInputRef.current.value="";

};







const removePendingAttachment=(id:string)=>{

setPendingAttachments(prev=>
prev.filter(a=>a.id!==id)
);

};









const handleSend = async()=>{


const text=input.trim();



if((!text && pendingAttachments.length===0)||busy)
return;



setBusy(true);



let currentKey=ocrKey;



try{



if(pendingAttachments.length){



const formData=new FormData();



const blob =
await (await fetch(pendingAttachments[0].dataUrl)).blob();



formData.append(
"file",
blob,
pendingAttachments[0].name
);




const upload =
await fetch("/api/chat-bot",{

method:"POST",

body:formData

});



const uploadData=await upload.json();



if(uploadData.key){

currentKey=uploadData.key;

setOcrKey(uploadData.key);

}


}





setMessages(prev=>[

...prev,

{

id:createId(),

role:"user",

content:text,

attachments:
pendingAttachments.length
?
[...pendingAttachments]
:
undefined,

timestamp:new Date()

}

]);





setInput("");

setPendingAttachments([]);




const response =
await fetch("/api/chat-bot",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

key:currentKey,

question:text,

sessionId:sessionId || undefined

})

});





const data=await response.json();





if(data.sessionId)
setSessionId(data.sessionId);





let answer =
data.answer ||
data.error ||
"Not enough data.";






setMessages(prev=>[

...prev,

{

id:createId(),

role:"assistant",

content:answer,

timestamp:new Date()

}

]);


}catch(err){



setMessages(prev=>[

...prev,

{

id:createId(),

role:"assistant",

content:
"حدث خطأ في الاتصال بالسيرفر.",

timestamp:new Date()

}

]);


}



finally{

setBusy(false);

}


};







const handleKeyDown=
(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{


if(e.key==="Enter"&&!e.shiftKey){

e.preventDefault();

void handleSend();

}

};






const handleInputChange=
(e:React.ChangeEvent<HTMLTextAreaElement>)=>{


setInput(e.target.value);


e.target.style.height="auto";

e.target.style.height=
`${Math.min(e.target.scrollHeight,160)}px`;

};








if(loading || !user)

return (

<div className="dashboard-layout">

<div className="loading-container">

Loading…

</div>

</div>

);






return (

<div className="dashboard-layout">


<DashboardSidebar
user={user}
userProfile={userProfile}
/>



<main className="dashboard-main">


<div className="dashboard-content ai-chat-page">


<DashboardHeader userName={firstName}/>



<div className="ai-chat-container">



<div style={{
display:"flex",
justifyContent:"flex-end",
marginBottom:10
}}>


<button
onClick={handleNewChat}
style={{
background:"#111",
color:"#fff",
padding:"8px 12px",
borderRadius:8,
border:"none",
cursor:"pointer"
}}
>

+ New Chat

</button>


</div>





<div className="ai-chat-header">

<span className="ai-chat-header-icon">

<MdChat/>

</span>


<div>

<h2 className="ai-chat-title">
AI Assistant
</h2>


<p className="ai-chat-subtitle">

Ask anything - attach images or files for context

</p>


</div>

</div>





<div className="ai-chat-messages">



{messages.map(msg=>(

<div
key={msg.id}
className={`ai-chat-bubble-row ${msg.role}`}
>


{msg.role==="assistant" &&
<div className="ai-chat-avatar ai">

<MdChat/>

</div>
}




<div className={`ai-chat-bubble ${msg.role}`}>



{msg.attachments &&

<div className="msg-attachments">

{msg.attachments.map(a=>(

<div key={a.id} className="msg-attachment-item">

<MdInsertDriveFile/>

{a.name}

</div>

))}

</div>

}




<p>{msg.content}</p>


</div>


</div>

))}





{busy &&

<div className="ai-chat-bubble-row assistant">

<div className="ai-chat-bubble assistant">

جاري التفكير...

</div>

</div>

}



<div ref={messagesEndRef}/>


</div>





{pendingAttachments.length>0 &&

<div className="ai-chat-attachments-preview">

{pendingAttachments.map(file=>(

<div
key={file.id}
className="attachment-preview-item"
>


<MdInsertDriveFile/>


<span>

{file.name}
({formatBytes(file.size)})

</span>


<button onClick={()=>
removePendingAttachment(file.id)
}>

<MdClose/>

</button>


</div>

))}


</div>

}






<div className="ai-chat-input-wrapper">


<div className="ai-chat-input-area">


<input

ref={fileInputRef}

type="file"

hidden

onChange={
e=>handleFileSelect(e.target.files)
}

/>



<button
className="ai-chat-attach-btn"
onClick={()=>
fileInputRef.current?.click()
}
>

<MdAttachFile/>

</button>





<textarea

ref={textareaRef}

className="ai-chat-input"

placeholder="Ask me anything..."

value={input}

onChange={handleInputChange}

onKeyDown={handleKeyDown}

rows={1}

/>





<button

className="ai-chat-send-btn"

onClick={()=>
void handleSend()
}

disabled={busy}

>

<MdSend/>

</button>



</div>


</div>



</div>


</div>


</main>


</div>

);


}
