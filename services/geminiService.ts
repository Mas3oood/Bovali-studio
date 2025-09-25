import { GoogleGenAI, Modality, Chat } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const createBovaliChat = (): Chat => {
    const systemInstruction = `
    You are a sophisticated and knowledgeable AI assistant for Bovali, a luxury brand specializing in high-end flooring and cladding. 
    Your expertise lies in contemporary architecture and Italian design. Your purpose is to assist clients by answering questions about 
    Bovali's products, explaining the AI design generation process, and offering expert design advice. When the user provides an instruction to edit an image, you fulfill the request and provide a brief confirmation. Maintain a professional, 
    elegant, and helpful tone at all times. If a question is outside the scope of interior design, flooring, cladding, or Bovali, 
    politely state that your expertise is focused on these areas.
    `;

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
    });
};

export const editImageWithPrompt = async (
    base64Image: string,
    mimeType: string,
    prompt: string
): Promise<{ imageUrl: string | null; text: string | null }> => {
    try {
        const fullPrompt = `
            As an expert AI image editor, edit the provided image based on the following instruction, ensuring the result is photorealistic and maintains the original image's context.
            Instruction: "${prompt}"
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: mimeType,
                        },
                    },
                    { text: fullPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        let imageUrl: string | null = null;
        let text: string | null = null;

        if (response.candidates && response.candidates.length > 0) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
              } else if (part.text) {
                text = part.text;
              }
            }
        }

        if (!imageUrl) {
            if (text) {
                throw new Error(`The AI responded but did not return an image: "${text}"`);
            }
            throw new Error("The AI did not return an image for your edit request.");
        }

        return { imageUrl, text };
    } catch (error) {
        console.error('Error editing image:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("An unknown error occurred while editing the image.");
    }
};

// A generic function to handle image generation to reduce code duplication
const generateSurfaceDesign = async (
    prompt: string,
    images: { file: File }[]
): Promise<{ imageUrl: string | null }> => {
    try {
        const imageParts = await Promise.all(
            images.map(async (image) => {
                const base64 = await fileToBase64(image.file);
                return {
                    inlineData: {
                        data: base64,
                        mimeType: image.file.type,
                    },
                };
            })
        );

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    ...imageParts,
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        let imageUrl: string | null = null;
        if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes = part.inlineData.data;
                    imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                    break; 
                }
            }
        }
        
        if (!imageUrl) {
            throw new Error("AI failed to generate a new image. Please try a different combination of images or prompt.");
        }

        return { imageUrl };

    } catch (error) {
        console.error('Error generating surface design:', error);
        throw error;
    }
};

export const extractAndProcessImage = async (
    sourceImage: File,
    extractionType: 'Pattern' | 'Material',
    dimensions?: string
): Promise<{ imageUrl: string | null }> => {
    const dimensionInstruction = dimensions
        ? `The user has specified that the subject in the photo has real-world dimensions of ${dimensions}. Ensure the output image accurately reflects this scale.`
        : '';

    const prompt = `
        You are an expert AI assistant specializing in creating professional, catalogue-ready images for the luxury design brand Bovali.
        Your task is to process the user-submitted photograph and extract a specific element.
        Analyze the image and correct for any perspective distortion, angled views, uneven lighting, and color inconsistencies.
        The final result must be a clean, seamless, front-facing, high-resolution image of the requested element, suitable for a professional design catalogue.

        Extraction Type: Extract the ${extractionType}.
        - If 'Pattern', isolate the primary repeating pattern.
        - If 'Material', isolate the material's texture, color, and finish, ignoring distinct patterns unless they are part of the material itself (like wood grain).
        
        ${dimensionInstruction}

        Output only the processed image. Do not add text or other artifacts. The image is provided after this prompt.
    `;
    
    return generateSurfaceDesign(prompt, [{ file: sourceImage }]);
};


export const applyPatternAndMaterial = async (
    renderShot: File,
    pattern: File,
    material: File,
    surfaceType: 'Flooring' | 'Walls',
    tileDimensions?: string
): Promise<{ imageUrl: string | null }> => {
    const dimensionInstruction = tileDimensions
        ? `The "Pattern Image" represents a single tile with the dimensions ${tileDimensions}. Use this information to accurately scale the pattern on the surface.`
        : '';

    const prompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to modify the primary "Render Shot" image.
        Identify the ${surfaceType.toLowerCase()} in the "Render Shot".
        Apply the visual pattern from the "Pattern Image" to the ${surfaceType.toLowerCase()}.
        Then, apply the texture, material properties (like gloss, reflection, texture), and color palette from the "Material Image" to the same ${surfaceType.toLowerCase()}.
        ${dimensionInstruction}
        The final result must be a single, photorealistic image that seamlessly integrates the new pattern and material onto the specified surface in the original render shot, maintaining realistic lighting, shadows, and perspective.
        Do not add any text or other artifacts to the image. Output only the modified image.
        The images are provided after this prompt.
    `;
    return generateSurfaceDesign(prompt, [
        { file: renderShot },
        { file: pattern },
        { file: material },
    ]);
};

export const applyPatternOnly = async (
    renderShot: File,
    pattern: File,
    surfaceType: 'Flooring' | 'Walls',
    tileDimensions?: string
): Promise<{ imageUrl: string | null }> => {
    const dimensionInstruction = tileDimensions
        ? `The "Pattern Image" represents a single tile with the dimensions ${tileDimensions}. Use this information to accurately scale the pattern on the surface.`
        : '';
    const prompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to modify the primary "Render Shot" image.
        Identify the ${surfaceType.toLowerCase()} in the "Render Shot".
        Apply ONLY the visual pattern from the "Pattern Image" to the ${surfaceType.toLowerCase()}.
        ${dimensionInstruction}
        The original material, texture, lighting, and colors of the surface in the "Render Shot" should be preserved as much as possible.
        The final result must be a single, photorealistic image that seamlessly integrates the new pattern onto the specified surface in the original render shot, maintaining realistic lighting, shadows, and perspective.
        Do not add any text or other artifacts to the image. Output only the modified image.
        The images are provided after this prompt.
    `;
    return generateSurfaceDesign(prompt, [
        { file: renderShot },
        { file: pattern },
    ]);
};

export const applyMaterialOnly = async (
    renderShot: File,
    material: File,
    surfaceType: 'Flooring' | 'Walls'
): Promise<{ imageUrl: string | null }> => {
    const prompt = `
        You are an AI assistant for Bovali, a luxury interior design brand.
        Your task is to modify the primary "Render Shot" image.
        Identify the ${surfaceType.toLowerCase()} in the "Render Shot".
        Apply ONLY the texture, material properties (like gloss, reflection, texture), and color palette from the "Material Image" to the ${surfaceType.toLowerCase()}.
        If the original surface had a pattern, it should be preserved if possible, but rendered with the new material properties.
        The final result must be a single, photorealistic image that seamlessly integrates the new material onto the specified surface in the original render shot, maintaining realistic lighting, shadows, and perspective.
        Do not add any text or other artifacts to the image. Output only the modified image.
        The images are provided after this prompt.
    `;
    return generateSurfaceDesign(prompt, [
        { file: renderShot },
        { file: material },
    ]);
};