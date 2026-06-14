import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";


const tmpBase = path.join(os.tmpdir(), "handwriting-recognition");
const dataFile = path.join(tmpBase, "ocrData.json");


// قراءة البيانات
async function readDataStore() {
    try {
        const raw = await fs.readFile(dataFile, "utf8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}


// حفظ البيانات
async function writeDataStore(data: any) {
    await fs.writeFile(
        dataFile,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}



export async function POST(req: NextRequest) {

    try {

        const body = await req.json();

        const key = body.key;
        const question = body.question || "";


        if (!key) {
            return NextResponse.json(
                { error: "No key provided" },
                { status: 400 }
            );
        }


        if (!question.trim()) {
            return NextResponse.json(
                { error: "Empty question" },
                { status: 400 }
            );
        }



        const db = await readDataStore();

        const userData = db[key];


        if (!userData) {
            return NextResponse.json(
                { error: "Analysis data not found" },
                { status: 404 }
            );
        }



        // آخر 10 رسائل فقط
        const history = userData.history || [];

        const historyText = history
            .slice(-10)
            .map(
                (h:any)=>
                `User: ${h.question}
AI: ${h.answer}`
            )
            .join("\n");




        /*
          تجهيز بيانات التحليل
          من نظام الـ OCR الخاص بك
        */

        const analysisContext = `

Extracted OCR Text:
${userData.text || "No OCR text available"}


OCR Accuracy:
${userData.accuracy || "Unknown"}%


Forgery Detection:
${JSON.stringify(
    userData.forgery || 
    "No forgery analysis available"
)}


Handwriting Improvement Tips:
${
    userData.tips?.join("\n") ||
    "No handwriting tips available"
}

`;




        const prompt = `

You are an AI handwriting analysis assistant.

Your job:
- Explain OCR results
- Explain handwriting quality
- Explain accuracy score
- Explain forgery detection
- Give handwriting improvement advice


Rules:
1. Use only the provided analysis data.
2. Do not invent OCR results.
3. If information is missing say you don't know.
4. Answer clearly and simply.
5. If the user asks about handwriting, provide practical advice.


====================

Analysis Data:

${analysisContext}


Previous Conversation:

${historyText}


User Question:

${question}


`;




        if (!process.env.OPENROUTER_API_KEY) {

            throw new Error(
                "OPENROUTER_API_KEY missing"
            );

        }




        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {

                method:"POST",

                headers:{
                    "Authorization":
                    `Bearer ${process.env.OPENROUTER_API_KEY}`,

                    "Content-Type":
                    "application/json"
                },


                body:JSON.stringify({

                    model:
                    "meta-llama/llama-3.1-8b-instruct",


                    messages:[

                        {
                            role:"system",
                            content:
                            "You are a handwriting recognition expert assistant."
                        },

                        {
                            role:"user",
                            content:prompt
                        }

                    ],


                    temperature:0.3

                })

            }
        );




        const aiData = await response.json();



        if(!response.ok){

            throw new Error(
                aiData.error?.message ||
                "AI request failed"
            );

        }




        const answer =
        aiData.choices?.[0]?.message?.content
        ||
        "لم أستطع الحصول على إجابة";





        // حفظ المحادثة

        userData.history =
        userData.history || [];


        userData.history.push({

            question,

            answer,

            date:new Date().toISOString()

        });



        // منع تضخم الملف

        userData.history =
        userData.history.slice(-20);



        db[key] = userData;


        await writeDataStore(db);




        return NextResponse.json({

            answer

        });



    }

    catch(e:any){

        return NextResponse.json(
            {
                error:e.message
            },
            {
                status:500
            }
        );

    }

}
