import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-",
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "kgG7dCoKCfLehAPWkJOE";

const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

const lipSyncMessage = async (message) => {
  try {
    const time = new Date().getTime();
    console.log(`Starting conversion for message ${message}`);
    await execCommand(`ffmpeg -y -i audio/message_${message}.mp3 audio/message_${message}.wav`);
    console.log(`Conversion done in ${new Date().getTime() - time}ms`);
    await execCommand(`.\\Rhubarb\\rhubarb.exe -f json -o .\\audio\\message_${message}.json .\\audio\\message_${message}.wav -r phonetic`);

    console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.error(`Error in lipSyncMessage: ${error.message}`);
    throw error;
  }
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Enter your query",
          audio: await audioFileToBase64("audios/indro_0.ogg"),
          lipsync: await readJsonTranscript("audios/indro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "Hey friend how may i assist you",
          audio: await audioFileToBase64("audios/indro_2.ogg"),
          lipsync: await readJsonTranscript("audios/indro_2.json"),
          facialExpression: "sad",
          animation: "Talking_2",
        },
      ],
    });
    return;
  }

  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Enter your query",
          audio: await audioFileToBase64("audios/indro_0.ogg"),
          lipsync: await readJsonTranscript("audios/indro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "Hey friend how may i assist you",
          audio: await audioFileToBase64("audios/indro_2.ogg"),
          lipsync: await readJsonTranscript("audios/indro_2.json"),
          facialExpression: "sad",
          animation: "Talking_2",
        },
      ],
    });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 1000,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
            You are a virtual assistant.
            You will always reply with a JSON array of messages. With a maximum of 3 messages.
            Each message has a text, facialExpression, and animation property.
            The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
            The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
          `,
        },
        {
          role: "user",
          content: userMessage || "Hello",
        },
      ],
    });
  
    let messages;
  
    if (
      completion &&
      completion.choices &&
      completion.choices.length > 0 &&
      completion.choices[0].message
    ) {
      const content = completion.choices[0].message.content;
      console.log("Content from OpenAI:", content); // Log the content
  
      try {
        // Attempt to parse as JSON
        messages = JSON.parse(content);
  
        // Check if the expected properties are present
        if (!messages.messages) {
          throw new Error("Invalid response format from OpenAI");
        }
      } catch (jsonError) {
        // If parsing as JSON fails, treat it as a plain text response
        messages = [
          {
            text: content,
            facialExpression: "default",
            animation: "Idle",
          },
        ];
      }
    }
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      const fileName = `audios/message_${i}.mp3`;
      const textInput = message.text;

      await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
      await lipSyncMessage(i);

      message.audio = await audioFileToBase64(fileName);
      message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    }

    res.send({ messages });
  }  catch (error) {
    console.error(`Error in /chat route: ${error.message}`);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

const readJsonTranscript = async (file) => {
  try {
    const data = await fs.readFile(file, "utf8");
    console.log("Data read from file:", data);

    try {
      const parsedData = JSON.parse(data);
      return parsedData;
    } catch (jsonError) {
      console.error(`Error parsing JSON in file ${file}: ${jsonError.message}`);
      throw jsonError;
    }
  } catch (readError) {
    console.error(`Error reading file ${file}: ${readError.message}`);
    throw readError;
  }
};

const audioFileToBase64 = async (file) => {
  try {
    const data = await fs.readFile(file);
    return data.toString("base64");
  } catch (error) {
    console.error(`Error in audioFileToBase64: ${error.message}`);
    throw error;
  }
};

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Handle the error appropriately
});
