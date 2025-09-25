import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import { 
  createBovaliChat, 
  editImageWithPrompt,
  applyPatternAndMaterial,
  applyPatternOnly,
  applyMaterialOnly,
  extractAndProcessImage
} from './services/geminiService';
import { ImageState } from './types';
import type { Chat, GenerateContentResponse } from '@google/genai';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

type SurfaceType = 'Flooring' | 'Walls';
type GenerationMode = 'PatternAndMaterial' | 'PatternOnly' | 'MaterialOnly';
type TileUnit = 'cm' | 'inches';
type ActiveTab = 'generator' | 'extractor';
type ExtractionType = 'Pattern' | 'Material';


// Chatbot UI Component defined within App.tsx to avoid creating new files
const Chatbot: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onSendMessage: (message: string) => void;
  isBotTyping: boolean;
}> = ({ isOpen, onClose, messages, onSendMessage, isBotTyping }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isBotTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 sm:right-8 w-[calc(100%-2rem)] sm:w-96 h-[65vh] max-h-[700px] bg-white rounded-xl shadow-2xl flex flex-col font-sans z-50">
      <header className="bg-bovali-green text-white p-4 rounded-t-xl flex justify-between items-center">
        <h3 className="font-bold text-lg">Bovali Design Assistant</h3>
        <button onClick={onClose} className="text-2xl font-bold">&times;</button>
      </header>
      <div className="flex-1 p-4 overflow-y-auto bg-bovali-beige">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-bovali-green text-white' : 'bg-white text-bovali-dark'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        {isBotTyping && (
          <div className="flex justify-start mb-3">
              <div className="max-w-[80%] p-3 rounded-lg bg-white text-bovali-dark">
                  <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 bg-bovali-grey rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="h-2 w-2 bg-bovali-grey rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="h-2 w-2 bg-bovali-grey rounded-full animate-bounce"></span>
                  </div>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a design question..."
            className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-bovali-green focus:outline-none"
          />
          <button type="submit" className="bg-bovali-green text-white px-4 rounded-r-md hover:bg-opacity-90 transition-colors">
            Send
          </button>
        </div>
      </form>
    </div>
  );
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('generator');

  // Generator state
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('Flooring');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('PatternAndMaterial');
  const [renderShot, setRenderShot] = useState<ImageState>({ file: null, previewUrl: null });
  const [pattern, setPattern] = useState<ImageState>({ file: null, previewUrl: null });
  const [material, setMaterial] = useState<ImageState>({ file: null, previewUrl: null });
  const [outputImage, setOutputImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tileWidth, setTileWidth] = useState<string>('');
  const [tileHeight, setTileHeight] = useState<string>('');
  const [tileUnit, setTileUnit] = useState<TileUnit>('cm');

  // Extractor state
  const [sourceImage, setSourceImage] = useState<ImageState>({ file: null, previewUrl: null });
  const [extractionType, setExtractionType] = useState<ExtractionType>('Pattern');
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [sourceWidth, setSourceWidth] = useState<string>('');
  const [sourceHeight, setSourceHeight] = useState<string>('');
  const [sourceUnit, setSourceUnit] = useState<TileUnit>('cm');

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! How can I assist you with your Bovali design today?", sender: 'bot' }
  ]);
  const chatRef = useRef<Chat | null>(null);

  useEffect(() => {
    if (!chatRef.current) {
        chatRef.current = createBovaliChat();
    }
  }, []);

  useEffect(() => {
    // Reset state when tab changes to avoid confusion
    if (activeTab === 'generator') {
        setSourceImage({ file: null, previewUrl: null });
        setProcessedImage(null);
        setProcessingError(null);
        setSourceWidth('');
        setSourceHeight('');
    } else {
        setRenderShot({ file: null, previewUrl: null });
        setPattern({ file: null, previewUrl: null });
        setMaterial({ file: null, previewUrl: null });
        setOutputImage(null);
        setError(null);
        setTileWidth('');
        setTileHeight('');
    }
  }, [activeTab]);
  
  useEffect(() => {
      // Reset images when generator mode changes
      setRenderShot({ file: null, previewUrl: null });
      setPattern({ file: null, previewUrl: null });
      setMaterial({ file: null, previewUrl: null });
      setTileWidth('');
      setTileHeight('');
      setError(null);
      setOutputImage(null);
  }, [generationMode]);

  const parseDataUrl = (dataUrl: string): { mimeType: string; base64: string } => {
    const parts = dataUrl.split(',');
    const mimePart = parts[0].match(/:(.*?);/);
    if (!mimePart || mimePart.length < 2) {
        throw new Error("Invalid data URL format");
    }
    const mimeType = mimePart[1];
    const base64 = parts[1];
    return { mimeType, base64 };
  };

  const handleSendMessage = async (message: string) => {
    const newUserMessage: Message = { id: Date.now(), text: message, sender: 'user' };
    setMessages(prev => [...prev, newUserMessage]);
    setIsBotTyping(true);
    setError(null);

    // Only allow image editing if there's a generated image from the Generator Studio
    if (outputImage && activeTab === 'generator') {
        try {
            const { mimeType, base64 } = parseDataUrl(outputImage);
            const { imageUrl, text } = await editImageWithPrompt(base64, mimeType, message);
            if (imageUrl) {
                setOutputImage(imageUrl);
                const botMessage: Message = { id: Date.now() + 1, text: text || "Of course. Here is the updated design.", sender: 'bot'};
                setMessages(prev => [...prev, botMessage]);
            } else {
                throw new Error("The AI did not return a new image for your edit request.");
            }
        } catch (e) {
            console.error("Chat edit error:", e);
            const errorMessageText = e instanceof Error ? e.message : "Sorry, I couldn't edit the image. Please try a different instruction.";
            const errorMessage: Message = { id: Date.now() + 1, text: errorMessageText, sender: 'bot'};
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsBotTyping(false);
        }
    } else {
        if (chatRef.current) {
            try {
                const response: GenerateContentResponse = await chatRef.current.sendMessage({ message });
                const botMessageText = response.text;
                const newBotMessage: Message = { id: Date.now() + 1, text: botMessageText, sender: 'bot' };
                setMessages(prev => [...prev, newBotMessage]);
            } catch (e) {
                console.error("Chat error:", e);
                const errorMessage: Message = { id: Date.now() + 1, text: "I'm sorry, I encountered an error. Please try again.", sender: 'bot'};
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsBotTyping(false);
            }
        }
    }
  };

  const handleImageSelect = (
    file: File,
    setter: React.Dispatch<React.SetStateAction<ImageState>>
  ) => {
    setter(prevState => {
      if (prevState.previewUrl) {
        URL.revokeObjectURL(prevState.previewUrl);
      }
      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
    // Reset outputs when a new image is selected
    setOutputImage(null);
    setError(null);
    setProcessedImage(null);
    setProcessingError(null);
  };
  
  const handleImageRemove = (setter: React.Dispatch<React.SetStateAction<ImageState>>) => {
      setter(prevState => {
        if (prevState.previewUrl) {
            URL.revokeObjectURL(prevState.previewUrl);
        }
        return { file: null, previewUrl: null };
      });
      setOutputImage(null);
      setError(null);
      setProcessedImage(null);
      setProcessingError(null);
  }

  // --- Generator Studio Logic ---
  const handleGeneratorSubmit = async () => {
    setLoading(true);
    setError(null);
    setOutputImage(null);

    try {
      let result;
      let tileDimensions: string | undefined = undefined;
      if (tileWidth && tileHeight) {
          tileDimensions = `${tileWidth} x ${tileHeight} ${tileUnit}`;
      }

      switch (generationMode) {
        case 'PatternAndMaterial':
          if (!renderShot.file || !pattern.file || !material.file) {
            throw new Error("Please upload all three images for this mode.");
          }
          result = await applyPatternAndMaterial(renderShot.file, pattern.file, material.file, surfaceType, tileDimensions);
          break;
        case 'PatternOnly':
          if (!renderShot.file || !pattern.file) {
            throw new Error("Please upload a Render Shot and a Pattern Image for this mode.");
          }
          result = await applyPatternOnly(renderShot.file, pattern.file, surfaceType, tileDimensions);
          break;
        case 'MaterialOnly':
          if (!renderShot.file || !material.file) {
            throw new Error("Please upload a Render Shot and a Material Image for this mode.");
          }
          result = await applyMaterialOnly(renderShot.file, material.file, surfaceType);
          break;
        default:
          throw new Error("Invalid generation mode selected.");
      }
      
      if (result && result.imageUrl) {
        setOutputImage(result.imageUrl);
      } else {
        setError("Failed to generate image. The API did not return an image.");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getIsGeneratorButtonDisabled = () => {
    if(loading) return true;
    switch (generationMode) {
        case 'PatternAndMaterial':
            return !renderShot.file || !pattern.file || !material.file;
        case 'PatternOnly':
            return !renderShot.file || !pattern.file;
        case 'MaterialOnly':
            return !renderShot.file || !material.file;
        default:
            return true;
    }
  };

  // --- Extractor Studio Logic ---
  const handleProcessImage = async () => {
    if (!sourceImage.file) {
      setProcessingError("Please upload an image to process.");
      return;
    }
    setIsProcessing(true);
    setProcessingError(null);
    setProcessedImage(null);

    try {
      let dimensions: string | undefined = undefined;
      if (sourceWidth && sourceHeight) {
        dimensions = `${sourceWidth} x ${sourceHeight} ${sourceUnit}`;
      }

      const result = await extractAndProcessImage(sourceImage.file, extractionType, dimensions);
      
      if (result && result.imageUrl) {
        setProcessedImage(result.imageUrl);
      } else {
        setProcessingError("Failed to process image. The AI did not return an image.");
      }

    } catch (err) {
      if (err instanceof Error) {
        setProcessingError(err.message);
      } else {
        setProcessingError("An unknown error occurred during processing.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = `bovali_processed_${extractionType.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIsExtractorButtonDisabled = () => {
    return isProcessing || !sourceImage.file;
  };

  // --- UI Components ---
  const ModeButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
        isActive
          ? 'bg-bovali-green text-white shadow'
          : 'bg-white text-bovali-dark hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-8 py-3 rounded-full text-base font-semibold transition-all duration-300 transform hover:scale-105 ${
        isActive
          ? 'bg-bovali-green text-white shadow-lg'
          : 'bg-white text-bovali-dark hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen font-sans text-bovali-dark">
      <header className="bg-bovali-green text-white py-16">
          <div className="container mx-auto px-4 text-center">
              <h1 className="text-6xl font-serif mb-4 text-bovali-beige">
                  Bovali AI Studio
              </h1>
              <h2 className="text-3xl font-serif mb-6 leading-tight text-bovali-beige/80">
                  OUR STORY. OUR PHILOSOPHY. OUR CRAFT.
              </h2>
              <p className="text-lg max-w-4xl mx-auto font-sans font-light text-bovali-beige">
                  At BOVALI, we believe that floors and walls are more than structural elements—they are canvases of expression. Our journey began with a single question: How can design be both beautiful and personal? Driven by this idea, BOVALI was created to offer bespoke flooring and wall cladding solutions that blend precision, art, and technology.
              </p>
          </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="flex justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto mb-16">
            <TabButton label="Generator Studio" isActive={activeTab === 'generator'} onClick={() => setActiveTab('generator')} />
            <TabButton label="Extractor Studio" isActive={activeTab === 'extractor'} onClick={() => setActiveTab('extractor')} />
        </div>

        {activeTab === 'generator' && (
          // --- GENERATOR STUDIO UI ---
          <div>
            <div className="max-w-5xl mx-auto">
                <div className="mb-10">
                    <h2 className="text-3xl font-serif text-bovali-dark mb-4 text-center">1. Select Surface Type</h2>
                    <div className="flex justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto">
                        <ModeButton label="Flooring" isActive={surfaceType === 'Flooring'} onClick={() => setSurfaceType('Flooring')} />
                        <ModeButton label="Walls" isActive={surfaceType === 'Walls'} onClick={() => setSurfaceType('Walls')} />
                    </div>
                </div>

                <div className="mb-12">
                    <h2 className="text-3xl font-serif text-bovali-dark mb-4 text-center">2. Select Generation Mode</h2>
                    <div className="flex flex-wrap justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto">
                        <ModeButton label="Apply Pattern & Material" isActive={generationMode === 'PatternAndMaterial'} onClick={() => setGenerationMode('PatternAndMaterial')} />
                        <ModeButton label="Apply Pattern Only" isActive={generationMode === 'PatternOnly'} onClick={() => setGenerationMode('PatternOnly')} />
                        <ModeButton label="Apply Material Only" isActive={generationMode === 'MaterialOnly'} onClick={() => setGenerationMode('MaterialOnly')} />
                    </div>
                </div>
                
                <div>
                    <h2 className="text-3xl font-serif text-bovali-dark mb-6 text-center">3. Upload Your Images</h2>
                    <div className="flex flex-wrap justify-center gap-8 mb-12">
                      <div className="w-full max-w-sm">
                        <ImageUploader title="Render Shot" onImageSelect={(file) => handleImageSelect(file, setRenderShot)} previewUrl={renderShot.previewUrl} onImageRemove={() => handleImageRemove(setRenderShot)} />
                      </div>
                      { (generationMode === 'PatternAndMaterial' || generationMode === 'PatternOnly') && (
                        <div className="w-full max-w-sm">
                          <ImageUploader title="Pattern Image" onImageSelect={(file) => handleImageSelect(file, setPattern)} previewUrl={pattern.previewUrl} onImageRemove={() => handleImageRemove(setPattern)} />
                        </div>
                      )}
                      { (generationMode === 'PatternAndMaterial' || generationMode === 'MaterialOnly') && (
                        <div className="w-full max-w-sm">
                          <ImageUploader title="Material Image" onImageSelect={(file) => handleImageSelect(file, setMaterial)} previewUrl={material.previewUrl} onImageRemove={() => handleImageRemove(setMaterial)} />
                        </div>
                      )}
                    </div>
                </div>
            </div>

            { (generationMode === 'PatternAndMaterial' || generationMode === 'PatternOnly') && (
                <div className="max-w-5xl mx-auto mb-12">
                    <h2 className="text-3xl font-serif text-bovali-dark mb-6 text-center">4. Specify Tile Dimensions <span className="text-xl text-bovali-grey">(Optional)</span></h2>
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 p-6 bg-white rounded-lg shadow-sm border border-gray-200/80 w-fit mx-auto">
                        <div className="flex items-center gap-2">
                            <label htmlFor="tile-width" className="font-semibold text-bovali-dark">Width:</label>
                            <input id="tile-width" type="number" value={tileWidth} onChange={(e) => setTileWidth(e.target.value)} placeholder="e.g., 60" className="w-28 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" aria-label="Tile width" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="tile-height" className="font-semibold text-bovali-dark">Height:</label>
                            <input id="tile-height" type="number" value={tileHeight} onChange={(e) => setTileHeight(e.target.value)} placeholder="e.g., 120" className="w-28 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" aria-label="Tile height" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="tile-unit" className="font-semibold text-bovali-dark">Unit:</label>
                            <select id="tile-unit" value={tileUnit} onChange={(e) => setTileUnit(e.target.value as TileUnit)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none bg-white" aria-label="Tile dimension unit">
                                <option value="cm">cm</option>
                                <option value="inches">inches</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-center text-sm text-bovali-grey mt-4">Providing dimensions helps the AI accurately scale the pattern.</p>
                </div>
            )}

            <div className="text-center mb-12">
              <button onClick={handleGeneratorSubmit} disabled={getIsGeneratorButtonDisabled()} className="bg-bovali-green text-white font-bold py-4 px-12 rounded-full text-xl hover:bg-opacity-90 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105">
                {loading ? 'Generating...' : 'Generate Design'}
              </button>
            </div>

            {error && <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-8 max-w-4xl mx-auto" role="alert"><strong className="font-bold">Error: </strong><span className="block sm:inline">{error}</span></div>}
            {loading && <div className="text-center"><p className="text-lg text-bovali-grey animate-pulse">The AI is working its magic... This can take a moment.</p><p className="text-sm text-gray-400 mt-2">Generating high-quality product visualizations requires complex processing. Thanks for your patience!</p></div>}

            {outputImage && (
              <div className="mt-8">
                <h2 className="text-4xl font-serif text-center text-bovali-green mb-6">Generated Result</h2>
                <div className="flex justify-center"><div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200"><img src={outputImage} alt="Generated product" className="max-w-full md:max-w-2xl lg:max-w-4xl h-auto rounded-md" /></div></div>
                <div className="text-center max-w-2xl mx-auto mt-6 p-4 bg-bovali-green/10 rounded-lg"><p className="text-bovali-green font-semibold">Want to make a change? Open the Design Assistant chat and describe your edit.</p><p className="text-sm text-bovali-grey mt-1">For example: "make the texture darker" or "add more gold veins".</p></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'extractor' && (
          // --- EXTRACTOR STUDIO UI ---
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-serif text-bovali-dark mb-3">Extractor Studio</h2>
              <p className="text-lg text-bovali-grey max-w-3xl mx-auto">Found inspiration in the wild? Upload a photo, and our AI will process it into a professional, catalogue-ready asset you can download.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-10 items-start">
              {/* Input Column */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200/80">
                <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">1. Upload Your Photo</h3>
                <ImageUploader title="Source Photo" onImageSelect={(file) => handleImageSelect(file, setSourceImage)} previewUrl={sourceImage.previewUrl} onImageRemove={() => handleImageRemove(setSourceImage)} />

                <h3 className="text-2xl font-serif text-bovali-dark mb-4 mt-8 text-center">2. Select Extraction Type</h3>
                <div className="flex justify-center items-center gap-4 bg-gray-200/50 p-2 rounded-full w-fit mx-auto">
                  <ModeButton label="Pattern" isActive={extractionType === 'Pattern'} onClick={() => setExtractionType('Pattern')} />
                  <ModeButton label="Material" isActive={extractionType === 'Material'} onClick={() => setExtractionType('Material')} />
                </div>

                <div className="mt-8">
                  <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">3. Dimensions <span className="text-lg text-bovali-grey">(Optional)</span></h3>
                   <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 rounded-lg w-fit mx-auto">
                        <div className="flex items-center gap-2">
                            <label htmlFor="source-width" className="font-semibold text-bovali-dark text-sm">Width:</label>
                            <input id="source-width" type="number" value={sourceWidth} onChange={(e) => setSourceWidth(e.target.value)} placeholder="e.g., 60" className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" aria-label="Source width" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="source-height" className="font-semibold text-bovali-dark text-sm">Height:</label>
                            <input id="source-height" type="number" value={sourceHeight} onChange={(e) => setSourceHeight(e.target.value)} placeholder="e.g., 120" className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none" aria-label="Source height" />
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="source-unit" className="font-semibold text-bovali-dark text-sm">Unit:</label>
                            <select id="source-unit" value={sourceUnit} onChange={(e) => setSourceUnit(e.target.value as TileUnit)} className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-bovali-green focus:outline-none bg-white" aria-label="Source dimension unit">
                                <option value="cm">cm</option>
                                <option value="inches">inches</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-10">
                  <button onClick={handleProcessImage} disabled={getIsExtractorButtonDisabled()} className="bg-bovali-green text-white font-bold py-4 px-12 rounded-full text-xl hover:bg-opacity-90 transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105">
                    {isProcessing ? 'Processing...' : 'Process Image'}
                  </button>
                </div>
              </div>
              
              {/* Output Column */}
              <div className="bg-white p-8 rounded-lg shadow-md border border-gray-200/80 sticky top-8">
                <h3 className="text-2xl font-serif text-bovali-dark mb-4 text-center">Processed Result</h3>
                <div className="flex flex-col items-center justify-center w-full h-96 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50">
                  {isProcessing && <p className="text-lg text-bovali-grey animate-pulse">AI is processing your image...</p>}
                  {processingError && <div className="text-center text-red-700 px-4"><strong className="font-bold">Error:</strong> {processingError}</div>}
                  {processedImage && <img src={processedImage} alt="Processed asset" className="object-contain w-full h-full rounded-lg" />}
                  {!isProcessing && !processingError && !processedImage && <p className="text-bovali-grey text-center px-4">Your processed image will appear here.</p>}
                </div>
                 {processedImage && (
                    <div className="text-center mt-6">
                      <button onClick={handleDownload} className="bg-bovali-dark text-white font-semibold py-3 px-8 rounded-full hover:bg-opacity-90 transition-colors">
                        Download Image
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-bovali-grey text-sm border-t border-gray-200 mt-12">
        <p>Powered by Bovali AI Studio</p>
      </footer>
      
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={messages} onSendMessage={handleSendMessage} isBotTyping={isBotTyping} />
      <button onClick={() => setIsChatOpen(true)} className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-bovali-green text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-opacity-90 transform hover:scale-110 transition-all z-40" aria-label="Open chat">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="to 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  );
};

export default App;