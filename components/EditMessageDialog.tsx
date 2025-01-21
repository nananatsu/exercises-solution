import { Modal, StyleSheet, TouchableOpacity, TextInput, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useState } from 'react';

interface EditMessageDialogProps {
    visible: boolean;
    message: string;
    onClose: () => void;
    onSave: (text: string) => void;
}

export function EditMessageDialog({ visible, message, onClose, onSave }: EditMessageDialogProps) {
    const [text, setText] = useState(message);

    const handleSave = () => {
        onSave(text.trim());
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
}); 