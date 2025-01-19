import { StyleSheet, FlatList, TouchableOpacity, Image, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { MarkdownLatex } from '@/components/MarkdownLatex';

type HistoryItem = {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  type: 'text' | 'image';
  imageUri?: string;
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem('history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">历史记录</ThemedText>
      </ThemedView>

      <FlatList
        data={history}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.historyItem}
            onPress={() => toggleExpand(item.id)}
          >
            <ThemedView style={styles.questionContainer}>
              {item.type === 'image' && item.imageUri && (
                <Image 
                  source={{ uri: item.imageUri }} 
                  style={styles.thumbnail}
                />
              )}
              <ThemedText style={styles.question}>{item.question}</ThemedText>
            </ThemedView>
            
            {expandedItems.has(item.id) && (
              <ThemedView style={styles.answerContainer}>
                <MarkdownLatex
                  content={item.answer}
                  textColor="#333"
                  baseStyles={{
                    body: styles.answer,
                  }}
                />
              </ThemedView>
            )}
            
            <ThemedText style={styles.date}>{formatDate(item.timestamp)}</ThemedText>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
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
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  answerContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  answer: {
    fontSize: 14,
    color: '#333',
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