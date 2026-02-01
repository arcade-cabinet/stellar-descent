#!/usr/bin/env npx tsx
/**
 * GenAI Quality Test Script
 *
 * Tests the Gemini AI integration by generating one portrait and one video.
 * Run with: pnpm exec tsx scripts/test-genai.ts
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';

// Model IDs - January 2026
const MODELS = {
  text: 'gemini-3-pro-preview',
  image: 'gemini-2.5-flash-image',
  imageHighQuality: 'gemini-3-pro-image-preview',
  videoFast: 'veo-3.1-fast-generate-preview',
  video: 'veo-3.1-generate-preview',
};

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'generated');

async function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
}

async function testImageGeneration(ai: GoogleGenAI): Promise<boolean> {
  console.log('\n=== Testing Image Generation ===');
  console.log(`Model: ${MODELS.imageHighQuality}`);

  const prompt = `Photorealistic character portrait of a battle-hardened space marine sergeant
    in his late 30s. Short dark hair with grey at temples, strong jaw, determined expression.
    Wearing futuristic military combat armor with unit patches. Dramatic lighting with key light
    from the side. Dark background. High detail, cinematic quality. Style reference: Mass Effect,
    Starship Troopers. This is Sergeant James Cole, callsign "SPECTER".`;

  console.log('Prompt:', `${prompt.slice(0, 100)}...`);
  console.log('Generating...');

  try {
    const startTime = Date.now();

    const response = await ai.models.generateContent({
      model: MODELS.imageHighQuality,
      contents: prompt,
      config: {
        responseModalities: ['image', 'text'],
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Generation completed in ${elapsed}s`);

    // Extract image from response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data as string;
          const mimeType = part.inlineData.mimeType ?? 'image/png';
          const ext = mimeType.includes('jpeg') ? 'jpg' : 'png';

          // Save to file
          const outputPath = path.join(OUTPUT_DIR, `test_portrait_cole.${ext}`);
          const buffer = Buffer.from(imageData, 'base64');
          fs.writeFileSync(outputPath, buffer);

          console.log(`✅ Image saved: ${outputPath}`);
          console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
          console.log(`   Type: ${mimeType}`);
          return true;
        }
      }
    }

    console.log('❌ No image data in response');
    console.log('Response:', JSON.stringify(response, null, 2).slice(0, 500));
    return false;
  } catch (error) {
    console.error('❌ Image generation failed:', error);
    return false;
  }
}

async function testVideoGeneration(ai: GoogleGenAI): Promise<boolean> {
  console.log('\n=== Testing Video Generation ===');
  console.log(`Model: ${MODELS.videoFast} (using fast model for test)`);

  const prompt = `Cinematic sci-fi space station interior scene. Camera slowly moves through
    a cryo-bay with multiple hibernation pods glowing with soft blue light. Warning alarms
    flash red in the background. One pod begins to open with steam and hydraulic sounds.
    Dark metallic corridors with holographic displays. Dramatic lighting with lens flares.
    High-end CGI quality, Alien movie aesthetic, atmospheric tension. 8 seconds.`;

  console.log('Prompt:', `${prompt.slice(0, 100)}...`);
  console.log('Starting video generation (this may take several minutes)...');

  try {
    const startTime = Date.now();

    // Start video generation (personGeneration: 'allow' required by API)
    let operation = await ai.models.generateVideos({
      model: MODELS.videoFast,
      prompt: prompt,
      config: {
        aspectRatio: '16:9',
      },
    });

    console.log('Video generation started, polling for completion...');

    // Poll for completion
    const maxWaitTime = 600000; // 10 minutes
    const pollInterval = 10000; // 10 seconds
    let pollCount = 0;

    while (!operation.done) {
      if (Date.now() - startTime > maxWaitTime) {
        console.log('❌ Video generation timed out after 10 minutes');
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      pollCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`   Polling... (${elapsed}s elapsed, poll #${pollCount})`);

      operation = await ai.operations.getVideosOperation({ operation });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Generation completed in ${elapsed}s`);

    // Extract video
    if (operation.response?.generatedVideos?.length) {
      const video = operation.response.generatedVideos[0];
      const videoUri = video.video?.uri;

      if (videoUri) {
        console.log('Downloading video...');

        // Fetch the video
        const apiKey = process.env.GEMINI_API_KEY;
        const videoUrl = `${videoUri}&key=${apiKey}`;
        const response = await fetch(videoUrl);
        const videoBuffer = Buffer.from(await response.arrayBuffer());

        // Save to file
        const outputPath = path.join(OUTPUT_DIR, 'test_cinematic_cryo.mp4');
        fs.writeFileSync(outputPath, videoBuffer);

        console.log(`✅ Video saved: ${outputPath}`);
        console.log(`   Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        return true;
      }
    }

    console.log('❌ No video data in response');
    console.log('Response:', JSON.stringify(operation.response, null, 2).slice(0, 500));
    return false;
  } catch (error) {
    console.error('❌ Video generation failed:', error);
    return false;
  }
}

async function main() {
  console.log('=================================');
  console.log('Stellar Descent GenAI Quality Test');
  console.log('=================================');

  // Check API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable not set');
    console.log('Usage: GEMINI_API_KEY=your_key npx tsx scripts/test-genai.ts');
    process.exit(1);
  }

  console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);

  // Initialize
  const ai = new GoogleGenAI({ apiKey });
  await ensureOutputDir();

  // Run tests
  const imageResult = await testImageGeneration(ai);
  const videoResult = await testVideoGeneration(ai);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Image Generation: ${imageResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Video Generation: ${videoResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);

  process.exit(imageResult && videoResult ? 0 : 1);
}

main().catch(console.error);
