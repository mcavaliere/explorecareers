import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';

const together = new OpenAI({
  baseURL: 'https://together.hconeai.com/v1',
  apiKey: process.env.TOGETHER_API_KEY,
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

interface GetCareersRequest {
  resumeInfo: string;
  context: string;
}

export async function POST(request: NextRequest) {
  const { resumeInfo, context } = (await request.json()) as GetCareersRequest;

  const careerPathPrompt = `
  Give me 6 career paths that the following user could transition into based on their resume and any additional context. Respond like this in JSON: {jobTitle: string, jobDescription: string, timeline: string, salary: string, difficulty: string}.

  <example>
  [
    {
    "jobTitle": "UX Designer",
    "jobDescription": "Creates user-centered design solutions to improve product usability and user experience.",
    "timeline": "3-6 months",
    "salary": "$85k - $110k",
    "difficulty": "Medium"
    },
    {
    "jobTitle": "Digital Marketing Specialist",
    "jobDescription": "Develops and implements online marketing campaigns to drive business growth.",
    "timeline": "2-4 months",
    "salary": "$50k - $70k",
    "difficulty": "Low"
    },
    {
    "jobTitle": "Software Engineer",
    "jobDescription": "Designs, develops, and tests software applications to meet business needs.",
    "timeline": "6-12 months",
    "salary": "$100k - $140k",
    "difficulty": "High"
    },
    {
    "jobTitle": "Business Analyst",
    "jobDescription": "Analyzes business needs and develops solutions to improve operations and processes.",
    "timeline": "3-6 months",
    "salary": "$65k - $90k",
    "difficulty": "Medium"
    },
    {
    "jobTitle": "Cybersecurity Specialist",
    "jobDescription": "Protects computer systems and networks from cyber threats by developing and implementing security protocols.",
    "timeline": "6-12 months",
    "salary": "$80k - $120k",
    "difficulty": "High"
    }
    ]
  </example>

  <resume>
  ${resumeInfo}
  </resume>

  <additionalContext>
  ${context}
  </additionalContext>

ONLY respond with JSON, nothing else.
  `;

  const chatCompletion = await together.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a helpful career expert that ONLY responds in JSON.',
      },
      { role: 'user', content: careerPathPrompt },
    ],
    model: 'meta-llama/Llama-3-70b-chat-hf',
  });
  const careers = chatCompletion.choices[0].message.content;

  const careerInfoJSON = JSON.parse(careers!);
  console.log('initialResults', careerInfoJSON);

  let finalResults = await Promise.all(
    careerInfoJSON.map(async (career: any) => {
      try {
        const completion = await together.chat.completions.create({
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful career expert that ONLY responds in JSON.',
            },
            {
              role: 'user',
              content: `You are helping a person transition into the ${career.jobTitle} role. Given the context about the person, return more information about the ${career.jobTitle} role in JSON as follows: {workRequired: string, aboutTheRole: string, whyItsagoodfit: array[], roadmap: [{string: string}, ...]

          <example>
          {role: "SEO specialist", workRequired: "10-20 hrs/week", whyItsagoodfit: ["You want to do remote work and this is a good remote job"...], aboutTheRole: "SEO Specialists optimize websites to rank higher in search engine results, aiming to increase online visibility, drive organic traffic, and improve user engagement. They conduct keyword research, analyze competitors, and implement SEO strategies that include on-page optimization, link building, and content creation.", roadmap: [{"Weeks 1-4": "Prepare your resume and start applying for SEO Specialist positions. Leverage your portfolio to showcase your expertise."}, ...]
          </example>

          <context>
          ${resumeInfo}
          ${context}
          </context>

          ONLY respond with JSON, nothing else.`,
            },
          ],
          model: 'meta-llama/Llama-3-70b-chat-hf',
        });
        const specificCareer = completion.choices[0].message.content;
        const specificCareerJSON = JSON.parse(specificCareer!);

        const individualCareerInfo = { ...career, ...specificCareerJSON };
        return individualCareerInfo;
      } catch (error) {
        console.log('Career that errored: ', career.jobTitle);
        console.log({ error });
      }
    })
  );

  console.log({ finalResults });
  fs.writeFileSync('finalResults.json', JSON.stringify(finalResults));

  return new Response(JSON.stringify(finalResults), {
    status: 200,
  });
}
