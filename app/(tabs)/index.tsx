import { StyleSheet, TouchableOpacity, TextInput, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute } from '@react-navigation/native';
import { storage } from '@/services/storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MarkdownLatex } from '@/components/MarkdownLatex';
import { compressImage, imageToBase64 } from '@/utils/imageUtils';
import { uploadImage } from '@/services/imageHost';
import { imageCache } from '@/services/imageCache';
import { chatHistory } from '@/services/chat/history';
import { MessageControls } from '@/components/MessageControls';
import { ChatSession, ChatMessage, ChatConf } from '@/services/chat/types';
import { Session } from '@/services/chat/session';
import { EditMessageDialog } from '@/components/EditMessageDialog';
import { Image } from 'react-native';
import { ImagePreview } from '@/components/ImagePreview';

interface Settings extends ChatConf {
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
  const route = useRoute();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{
    message: ChatMessage;
    turn: number;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!settings) {
      return;
    }

    console.log("路由", route)

    if (route.params) {
      const { sessionId } = route.params as { sessionId: string };
      loadSession(sessionId);
    } else {
      createSession();
    }
  }, [route, settings]);

  const loadSettings = async () => {
    try {
      const settings = await storage.getItem<Settings>('settings');
      if (settings) {
        setSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const createSession = useCallback(async () => {
    try {
      console.log("初始化会话")
      // const sessionId = await chatHistory.getNextSessionId();
      // console.log("创建会话", sessionId)
      const session = new Session(
        {
          models: settings?.models || [],
          activeOCRModel: settings?.activeOCRModel || '',
          activeSolvingModel: settings?.activeSolvingModel || ''
        },
        {
          // id: sessionId,
          id: '',
          title: '',
          turns: [],
          timestamp: Date.now()
        },
        {}
      );

      console.log("更新会话状态·", session)
      setSession(session);
      setMessages(session.currentMessages);
      return session;
    } catch (error) {
      console.error('创建会话失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '创建会话失败');
    }
  }, [settings]);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      console.log("加载会话", sessionId)
      const chatSession = await chatHistory.getSession(sessionId);
      if (chatSession) {
        const messages = await chatHistory.getMessages(chatSession);
        const session = new Session(
          {
            models: settings?.models || [],
            activeOCRModel: settings?.activeOCRModel || '',
            activeSolvingModel: settings?.activeSolvingModel || ''
          },
          chatSession,
          messages
        );
        setSession(session);
        setMessages(session.currentMessages);
      }
      return session;
    } catch (error) {
      console.error('加载会话失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '加载会话失败');
    }
  }, [settings]);

  const processQuestion = async (options: ProcessQuestionOptions) => {
    try {
      setIsLoading(true);

      let chatSession = session;
      if (!chatSession) {
        throw new Error('会话未创建');
      }

      let questionText = options.text || '';
      let imageUrl = options.imageUri;

      console.log("创建用户消息", questionText, imageUrl)

      await chatSession?.createUserMessage({
        text: questionText,
        imageUri: imageUrl,
        originalUri: options.originalUri
      });

      // 获取LLM回复
      const answer = await chatSession?.chat();
      if (answer) {
        await chatSession?.createAssistantMessage(answer);
      }

      // 更新界面
      setMessages(chatSession?.currentMessages || []);
      setInputText('');

    } catch (error) {
      console.error('处理问题失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '处理失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    setInputText('');

    await processQuestion({ text });
  };

  const processImage = async (imageUri: string, isCamera: boolean = false) => {
    try {
      setIsLoading(true);
      // 压缩图片
      const compressedUri = await compressImage(imageUri);
      const base64 = await imageToBase64(compressedUri);
      let imageUrl = "";
      let originalUri = `data:image/jpeg;base64,${base64}`;

      // 检查缓存
      const cachedUrl = await imageCache.getCachedUrl(originalUri);
      if (cachedUrl) {
        console.log('图片已缓存:', cachedUrl.uploadedUrl);
        imageUrl = cachedUrl.uploadedUrl;
      } else {
        // 上传到图床
        if (settings?.imageHost?.apiKey) {
          console.log('上传图片...');
          const uploadResult = await uploadImage(base64, settings.imageHost);
          if (uploadResult.success && uploadResult.url) {
            console.log('上传图片成功:', uploadResult.url);
            // 缓存上传结果
            await imageCache.cacheUrl(originalUri, uploadResult.url);
            imageUrl = uploadResult.url;
          }
        }
      }
      if (!imageUrl) {
        // 如果没有配置图床或上传失败，使用base64
        imageUrl = originalUri;
        originalUri = "";
      }

      await processQuestion({
        imageUri: imageUrl,
        isCamera,
        originalUri
      });
    } catch (error) {
      console.error('Process image failed:', error);
      Alert.alert('错误', '处理图片失败');
    } finally {
      setIsLoading(false);
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
  // 处理消息编辑
  const handleEditMessage = useCallback((message: ChatMessage, turn: number) => {
    setEditingMessage({ message, turn });
  }, []);

  // 保存编辑后的消息
  const handleSaveEdit = useCallback(async (message: ChatMessage) => {
    if (!editingMessage || !session) return;

    try {
      setIsLoading(true);

      // 更新用户消息
      await session.updateUserMessage(editingMessage.turn, { text: message.content, imageUri: message.imageUri, originalUri: message.originalUri });

      // 重新获取AI回复
      const answer = await session.refreshChat(editingMessage.turn);
      if (answer) {
        await session.createAssistantMessage(answer);
      }
      // 更新界面
      setMessages(session.currentMessages);
    } catch (error) {
      console.error('更新消息失败:', error);
      Alert.alert('错误', '更新失败');
    } finally {
      setIsLoading(false);
      setEditingMessage(null);
    }
  }, [editingMessage, session]);

  // 处理消息刷新
  const handleRefreshMessage = useCallback(async (turn: number) => {
    try {
      setIsLoading(true);
      if (!session) throw new Error('会话未创建');

      // 重新获取AI回复
      const answer = await session.refreshChat(turn);
      if (answer) {
        await session.updateAssistantMessage(turn, answer);
      }

      // 更新界面
      setMessages(session.currentMessages);
    } catch (error) {
      console.error('刷新消息失败:', error);
      Alert.alert('错误', '刷新失败');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // 处理版本切换
  const handleSwitchVersion = useCallback(async (turn: number, version: number) => {
    if (!session) return;

    try {
      await session.switchVersion(turn, version);
      setMessages(session?.currentMessages || []);
    } catch (error) {
      console.error('切换版本失败:', error);
      Alert.alert('错误', '切换失败');
    }
  }, [session]);

  const renderMessage = useCallback(({ item: message }: { item: ChatMessage }) => {
    const turn = session?.getTurn(message.turn);
    if (!turn) return null;

    return (
      <ThemedView
        style={[
          styles.messageContainer,
          message.role === 'user' ? styles.userMessage : styles.assistantMessage
        ]}
      >
        {message.role === 'assistant' ? (
          <>
            <MarkdownLatex
              content={message.content || ''}
              textColor={'#000000'}
              baseStyles={{
                body: [styles.markdownBody, styles.assistantMessageText],
              }}
            />
            <MessageControls
              position={turn.turn}
              version={turn.version}
              totalVersions={turn.messages.length}
              onRefresh={() => handleRefreshMessage(turn.turn)}
              onSwitch={version => handleSwitchVersion(turn.turn, version)}
            />
          </>
        ) : (
          <>
            <MarkdownLatex
              content={message.content || ''}
              textColor={'#000000'}
              baseStyles={{
                body: [styles.markdownBody, styles.userMessageText],
              }}
            />
            {(message.originalUri || message.imageUri) && (
              <TouchableOpacity
                onPress={() => setPreviewImage(message.originalUri || message.imageUri)}
              >
                <Image
                  source={{ uri: message.originalUri || message.imageUri }}
                  style={styles.messageImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
            <MessageControls
              position={turn.turn}
              version={turn.version}
              totalVersions={turn.messages.length}
              onEdit={() => handleEditMessage(message, turn.turn)}
              onSwitch={version => handleSwitchVersion(turn.turn, version)}
            />
          </>
        )}
      </ThemedView>
    );
  }, [session, handleEditMessage, handleRefreshMessage, handleSwitchVersion]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >

      <FlatList<ChatMessage>
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

      <EditMessageDialog
        visible={!!editingMessage}
        message={editingMessage?.message}
        onClose={() => setEditingMessage(null)}
        onSave={handleSaveEdit}
      />

      <ImagePreview
        visible={!!previewImage}
        imageUri={previewImage || ''}
        onClose={() => setPreviewImage(null)}
      />
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
  messageImage: {
    width: '100%',
    height: 200,
    marginBottom: 8,
  },
});
