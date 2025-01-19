import { StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MarkdownLatex } from '@/components/MarkdownLatex';
import { compressImage, imageToBase64 } from '@/utils/imageUtils';
import { uploadImage } from '@/services/imageHost';
import { createOpenAI } from '@/services/openai';

type HistoryItem = {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  type: 'text' | 'image';
  imageUri?: string;
};

type Message = {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  imageUri?: string;
};

interface Settings {
  models: Array<{
    title: string;
    type: 'mm' | 'vl' | 'text';
    model: string;
    apiBase: string;
    apiKey: string;
    provider: string;
  }>;
  activeOCRModel: string;
  activeSolvingModel: string;
  imageHost: {
    type: string;
    apiKey: string;
    apiBase?: string;
  };
}

interface ProcessQuestionOptions {
  text?: string;
  imageUri?: string;
  isCamera?: boolean;
  originalUri?: string;
}

export default function HomeScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const processQuestion = async (options: ProcessQuestionOptions) => {
    if (!settings?.activeSolvingModel) {
      Alert.alert('错误', '请先在设置中选择解题模型');
      return;
    }

    setIsLoading(true);
    try {
      const solvingModel = settings.models.find(m => m.title === settings.activeSolvingModel);
      if (!solvingModel) {
        throw new Error('解题模型未找到');
      }

      let questionText = options.text || '';
      let imageUrl = options.imageUri;
      const displayUri = options.originalUri || options.imageUri; // 用于显示的URI

      // 如果有图片且是文本模型，需要先进行OCR
      if (imageUrl && solvingModel.type === 'text') {
        if (!settings.activeOCRModel) {
          throw new Error('请先选择题目识别模型');
        }
        const ocrModel = settings.models.find(m => m.title === settings.activeOCRModel);
        if (!ocrModel) {
          throw new Error('题目识别模型未找到');
        }

        questionText = await recognizeText(imageUrl, ocrModel);

        console.log('识别后的题目', questionText);
        return;
      }

      // 添加用户消息
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: options.isCamera ? '拍照题目' : (questionText || '图片题目'),
        timestamp: Date.now(),
        imageUri: displayUri, // 使用原始URI用于显示
      };
      setMessages(prev => [...prev, userMessage]);

      // 发送到解题模型
      const response = await solveQuestion(
        solvingModel,
        questionText,
        imageUrl, // 使用处理后的URL
        solvingModel.type === 'mm'
      );

      // 添加AI回复
      const aiMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMessage]);

      // 保存到历史记录
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        question: options.isCamera ? '拍照题目' : (options.text || '图片题目'),
        answer: response,
        timestamp: Date.now(),
        type: imageUrl ? 'image' : 'text',
        imageUri: displayUri, // 使用原始URI用于显示
      };
      await saveToHistory(historyItem);
    } catch (error) {
      console.error('Process question failed:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '处理题目失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !settings?.activeSolvingModel) return;

    const solvingModel = settings.models.find(m => m.title === settings.activeSolvingModel);
    if (!solvingModel) {
      Alert.alert('错误', '请先在设置中选择解题模型');
      return;
    }

    const text = inputText.trim();
    setInputText('');

    await processQuestion({ text });
  };

  const processImage = async (imageUri: string, isCamera: boolean = false) => {
    try {
      // 压缩图片
      const compressedUri = await compressImage(imageUri);
      const base64 = await imageToBase64(compressedUri);
      let imageUrl = "";
      let originalUri = compressedUri;

      // 上传到图床
      if (settings?.imageHost?.apiKey) {
        const uploadResult = await uploadImage(base64, settings.imageHost);
        if (uploadResult.success && uploadResult.url) {
          imageUrl = uploadResult.url;
        }
      }
      // 如果没有配置图床或上传失败，使用base64
      if (!imageUrl) {
        imageUrl = `data:image/jpeg;base64,${base64}`;
      }

      await processQuestion({ imageUri: imageUrl, isCamera, originalUri: originalUri });
    } catch (error) {
      console.error('Process image failed:', error);
      Alert.alert('错误', '处理图片失败');
    }
  };

  const recognizeText = async (imageUrl: string, model: Settings['models'][0]): Promise<string> => {
    try {
      const client = createOpenAI({
        apiKey: model.apiKey,
        apiBase: model.apiBase,
      });

      const response = await client.chat.completions.create({
        model: model.model,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的题目识别助手，主要负责识别数学、物理、化学等学科的试题。

请注意以下要求：
1. 只识别纯文字题目，如果题目包含数学公式、化学方程式等非纯文字内容，则返回识别失败
2. 对于数学符号，需要转换为 LaTeX 格式
3. 返回格式必须是合法的 JSON 字符串：{ "success": boolean, "text": string }
   - success: true 表示识别成功，false 表示识别失败
   - text: 识别成功时返回题目文本，失败时返回失败原因

示例输出：
成功：{"success":true,"text":"已知函数f(x)=2x+1，求f(3)的值。"}
失败：{"success":false,"text":"题目包含数学公式，无法识别"}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
              {
                type: 'text',
                text: '请识别这道题目。如果题目包含公式或其他非纯文字内容，请返回识别失败。',
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '');
      if (!result.success) {
        throw new Error(result.text);
      }

      console.log('识别结果：', result);
      return result.text;
    } catch (error) {
      console.error('OCR failed:', error);
      throw new Error(error instanceof Error ? error.message : '识别文字失败');
    }
  };

  const solveQuestion = async (
    model: Settings['models'][0],
    text: string,
    imageUrl?: string,
    isMultimodal: boolean = false
  ): Promise<string> => {
    try {
      const client = createOpenAI({
        apiKey: model.apiKey,
        apiBase: model.apiBase,
      });

      const messages = isMultimodal && imageUrl ? [
        {
          role: 'system',
          content: '你是一个专业的解题助手，请帮助分析题目并给出详细的解题步骤。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
            {
              type: 'text',
              text: '请解答这道题目，给出详细的解题步骤。',
            },
          ],
        },
      ] : [
        {
          role: 'system',
          content: '你是一个专业的解题助手，请帮助分析题目并给出详细的解题步骤。',
        },
        {
          role: 'user',
          content: text,
        },
      ];

      const response = await client.chat.completions.create({
        model: model.model,
        messages,
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Solve question failed:', error);
      throw new Error('解题失败');
    }
  };

  const takePicture = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.log('获取相机权限失败', status);
      Alert.alert('错误', '需要相机权限来拍照');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      await processImage(result.assets[0].uri, true);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      await processImage(result.assets[0].uri, false);
    }
  };

  const saveToHistory = async (item: HistoryItem) => {
    try {
      const stored = await AsyncStorage.getItem('history');
      const history: HistoryItem[] = stored ? JSON.parse(stored) : [];
      history.unshift(item); // 添加到开头
      await AsyncStorage.setItem('history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <ThemedView
      style={[
        styles.messageContainer,
        item.type === 'user' ? styles.userMessage : styles.assistantMessage
      ]}
    >
      {item.type === 'assistant' ? (
        <MarkdownLatex
          content={item.content}
          textColor={item.type === 'user' ? '#FFFFFF' : '#000000'}
          baseStyles={{
            body: [
              styles.markdownBody,
              item.type === 'user' ? styles.userMessageText : styles.assistantMessageText,
            ],
          }}
        />
      ) : (
        <ThemedText style={item.type === 'user' ? styles.userMessageText : styles.assistantMessageText}>
          {item.content}
        </ThemedText>
      )}
    </ThemedView>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
      />

      {isLoading && (
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>正在处理...</ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.inputContainer}>
        <ThemedView style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入题目或拍照解答..."
            placeholderTextColor="#999"
            multiline
          />
          <ThemedView style={styles.actionButtons}>
            <TouchableOpacity
              onPress={takePicture}
              style={styles.actionButton}
              disabled={isLoading}
            >
              <IconSymbol size={24} name="camera.fill" color={isLoading ? '#999' : '#007AFF'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.actionButton}
              disabled={isLoading}
            >
              <IconSymbol size={24} name="photo.fill" color={isLoading ? '#999' : '#007AFF'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              disabled={!inputText.trim() || isLoading}
            >
              <IconSymbol
                size={24}
                name="arrow.up.circle.fill"
                color={!inputText.trim() || isLoading ? '#999' : '#007AFF'}
              />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    padding: 16,
    paddingTop: 60,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9E9EB',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#000000',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 8,
  },
  inputContainer: {
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  codeBlock: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  markdownBody: {
    color: '#000000',
  },
  paragraph: {
    marginVertical: 4,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 2,
    borderRadius: 3,
  },
  inlineMath: {
    margin: 0,
    padding: 0,
  },
  blockMath: {
    margin: 8,
    alignSelf: 'center',
  },
});
