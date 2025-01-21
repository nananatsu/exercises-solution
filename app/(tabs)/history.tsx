import { StyleSheet, FlatList, TouchableOpacity, Image, Platform } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { chatHistory, ChatSession } from '@/services/chat/history';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialized = useRef(false);

  const loadHistory = useCallback(async (pageNum: number) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      console.log('加载历史记录...', pageNum);
      const items = await chatHistory.loadHistory(pageNum);
      if (pageNum === 0) {
        setHistory(items);
      } else {
        setHistory(prev => [...prev, ...items]);
      }
      setHasMore(await chatHistory.hasMoreHistory(pageNum));
      console.log('加载历史记录完成', items.length);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // 只在组件首次挂载时初始化
  useEffect(() => {
    if (!isInitialized.current) {
      console.log('历史页面首次初始化');
      isInitialized.current = true;
      chatHistory
        .initialize()
        .then(() => loadHistory(0))
        .catch(error => console.error('初始化失败:', error));
    }
  }, [loadHistory]);

  // useFocusEffect(
  //   useCallback(() => {
  //     console.log('历史页面聚焦');
  //     loadHistory(0);
  //   }, [loadHistory])
  // );

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadHistory(nextPage);
    }
  }, [hasMore, isLoading, page, loadHistory]);

  const handleRefresh = useCallback(() => {
    setPage(0);
    loadHistory(0);
  }, [loadHistory]);

  const handleSessionPress = useCallback((sessionId: string) => {
    navigation.navigate('index', { sessionId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: ChatSession }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => handleSessionPress(item.id)}
    >
      <ThemedView style={styles.questionContainer}>
        {item.type === 'image' && item.imageUri && (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.thumbnail}
          />
        )}
        <ThemedText style={styles.title}>{item.title}</ThemedText>
      </ThemedView>

      <ThemedText style={styles.messageCount}>
        {Object.keys(item.messages).length} 条对话
      </ThemedText>

      <ThemedText style={styles.date}>
        {formatDate(item.timestamp)}
      </ThemedText>
    </TouchableOpacity>
  ), [handleSessionPress, formatDate]);

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">历史记录</ThemedText>
      </ThemedView>

      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={isLoading}
        onRefresh={handleRefresh}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginTop: 60,
    marginBottom: 20,
  },
  historyItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  messageCount: {
    fontSize: 12,
    color: '#666',
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
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
  mathExpression: {
    margin: 4,
  },
  markdownBody: {
    color: '#333',
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