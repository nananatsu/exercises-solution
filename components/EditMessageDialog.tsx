import { Modal, StyleSheet, TouchableOpacity, TextInput, View, Image } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useState, useEffect } from 'react';
import { ChatMessage } from '@/services/chat/types';
import { ImagePreview } from './ImagePreview';

interface EditMessageDialogProps {
    visible: boolean;
    message: ChatMessage;
    onClose: () => void;
    onSave: (message: ChatMessage) => void;
}

export function EditMessageDialog({ visible, message, onClose, onSave }: EditMessageDialogProps) {
    const [text, setText] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // 当消息改变时更新输入框
    useEffect(() => {
        if (visible && message) {
            setText(message.content || '');
        }
    }, [visible, message]);

    const handleSave = () => {
        message.content = text.trim();
        onSave(message);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <ThemedView style={styles.overlay}>
                <ThemedView style={styles.container}>
                    <ThemedText style={styles.title}>编辑消息</ThemedText>

                    {(message?.originalUri || message?.imageUri) && (
                        <TouchableOpacity
                            onPress={() => setPreviewImage(message.originalUri || message.imageUri)}
                        >
                            <Image
                                source={{ uri: message.originalUri || message.imageUri }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    )}

                    <TextInput
                        style={styles.input}
                        value={text}
                        onChangeText={setText}
                        multiline
                        placeholder="输入消息内容..."
                        placeholderTextColor="#999"
                    />

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                        >
                            <ThemedText>取消</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.saveButton]}
                            onPress={handleSave}
                        >
                            <ThemedText style={styles.saveButtonText}>保存</ThemedText>
                        </TouchableOpacity>
                    </View>
                </ThemedView>
            </ThemedView>

            <ImagePreview
                visible={!!previewImage}
                imageUri={previewImage || ''}
                onClose={() => setPreviewImage(null)}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '90%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    input: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        minHeight: 100,
        maxHeight: 200,
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    button: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    cancelButton: {
        backgroundColor: '#f0f0f0',
    },
    saveButton: {
        backgroundColor: '#007AFF',
    },
    saveButtonText: {
        color: '#fff',
    },
    previewImage: {
        width: '100%',
        height: 200,
        marginBottom: 16,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    messageImage: {
        width: '100%',
        height: 200,
        marginBottom: 8,
        borderRadius: 8,
    },
}); 