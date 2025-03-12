const express = require("express");
const app = express();
const pdf = require("pdf-parse");
const os = require("os");
const port = 3000;
const uploads = require("./configs/multer");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {Document,  Packer, Paragraph, TextRun} = require('docx');


//app setup
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

//gemini setup
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

//function to get notes
async function generatenotes(Syllabustxt) {
  const result = await model.generateContent(
    `Generate me very very detailed notes on my syllabus give 2 exapmles of each understand concepts in very detail each and ever topic sub topic should have explaination in very very large amount  each with example and also give example of code wherever needed i want to prepare for my exam each question is for 5 marks this is my syllabus and there is only first 3 units in exam so note that  ${Syllabustxt}`
  );
 await docxformat(result.response.text());
}

//function for a structured word file 
async function docxformat(text) {
    const lines = text.split("\n");
    let currentSection = [];
    let sections = [];

    lines.forEach((line) => {
        line = line.trim();
        if (/^\*\*(.*?)\*\*:/.test(line)) {
            const match = line.match(/^\*\*(.*?)\*\*:\s*(.*)/);
            if (match) {
                let headingText = match[1]; 
                let bodyText = match[2];  
                currentSection.push(
                    new Paragraph({
                        children: [new TextRun({ text: headingText, bold: true, size: 28 })],
                        spacing: { after: 150 },
                    })
                );
                if (bodyText) {
                    currentSection.push(
                        new Paragraph({
                            text: bodyText,
                            spacing: { after: 100 },
                        })
                    );
                }
            }
        }
     
        else if (line.startsWith("* Example")) {
            currentSection.push(
                new Paragraph({
                    children: [new TextRun({ text: line.replace("* ", ""), italics: true })],
                    bullet: { level: 1 }, 
                })
            );
        }
        
        else if (line.startsWith("* **")) {
            currentSection.push(
                new Paragraph({
                    children: [new TextRun({ text: line.replace("* **", "").replace("**", ""), bold: true, size: 24 })],
                    spacing: { after: 100 },
                })
            );
        }
        else if (line.startsWith("* ")) {
            currentSection.push(
                new Paragraph({
                    text: line.replace("* ", ""),
                    bullet: { level: 0 },
                })
            );
        }
        else if (/\*\*(.*?)\*\*/.test(line)) {
            const formattedText = line.replace(/\*\*(.*?)\*\*/g, (_, match) => match);
            currentSection.push(
                new Paragraph({
                    children: [new TextRun({ text: formattedText, bold: true })],
                    spacing: { after: 100 },
                })
            );
        }
        else if (line) {
            currentSection.push(
                new Paragraph({
                    text: line,
                    spacing: { after: 100 },
                })
            );
        }
    });
    if (currentSection.length > 0) {
        sections.push({ children: currentSection });
    }
    const doc = new Document({
        creator: "Uday",
        title: "Generated Notes",
        description: "Structured notes from Gemini AI",
        sections: sections,
    });
    
    const timestamp = new Date().getTime();
    const filePath = `notes_${timestamp}.docx`;
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    console.log("✅ DOCX created successfully!");
}

 
//function to upload your syllabus
app.post("/upload", uploads.single("Syllabus"), async (req, res) => {
  let databuffer = fs.readFileSync(req.file.path);
  await pdf(databuffer).then(async function (data) {
    await generatenotes(data.text);
  });
  res.redirect("/");
});

//main page
app.get("/", (req, res) => {
  res.render("index");
});

app.listen(port);
