import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Share, Platform } from 'react-native';
import { useState, useEffect } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { storage } from '@/services/storage';

type ModelType = 'mm' | 'vl' | 'text';

function getModelType(type: ModelType) {
    switch (type) {
        case 'mm': return '多模态';
        case 'vl': return '视觉理解';
        case 'text': return '文本';
    }
}

interface ModelConfig {
    title: string;
    type: ModelType;
    model: string;
    apiBase: string;
    apiKey: string;
    completionOptions: {
        presencePenalty: number;
        frequencyPenalty: number;
    };
    provider: string;
}

interface Settings {
    models: ModelConfig[];
    activeOCRModel: string;
    activeSolvingModel: string;
    imageHost: {
        type: string;
        apiKey: string;
        apiBase?: string;
    };
}

const defaultSettings: Settings = {
    models: [],
    activeOCRModel: '',
    activeSolvingModel: '',
    imageHost: {
        type: 'imgbb',
        apiKey: '',
    },
};

export default function SettingsScreen() {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await storage.getItem('settings');
            if (settings) {
                const mergedSettings = {
                    ...defaultSettings,
                    ...settings,
                };
                setSettings(mergedSettings);
            }
        } catch (error) {
            Alert.alert('错误', '加载设置失败');
        }
    };

    const saveSettings = async (newSettings: Settings) => {
        try {
            await storage.setItem('settings', newSettings);
            setSettings(newSettings);
            return true;
        } catch (error) {
            Alert.alert('错误', '保存设置失败');
            return false;
        }
    };

    const handleAddModel = () => {
        setEditingModel({
            title: '',
            type: 'text',
            model: '',
            apiBase: '',
            apiKey: '',
            completionOptions: {
                presencePenalty: 0,
                frequencyPenalty: 0.01,
            },
            provider: 'openai',
        });
        setIsEditing(true);
    };

    const handleEditModel = (model: ModelConfig) => {
        setEditingModel({ ...model });
        setIsEditing(true);
    };

    const handleSaveModel = () => {
        if (!editingModel?.title || !editingModel?.model) {
            Alert.alert('错误', '请填写模型名称和ID');
            return;
        }

        const newSettings = { ...settings };
        const existingIndex = settings.models.findIndex(m => m.title === editingModel.title);

        if (existingIndex >= 0) {
            const updatedModels = [...settings.models];
            updatedModels[existingIndex] = editingModel;
            newSettings.models = updatedModels;
        } else {
            newSettings.models = [...settings.models, editingModel];
        }

        saveSettings(newSettings);
        setIsEditing(false);
        setEditingModel(null);
    };

    const handleDeleteModel = (title: string) => {
        const newSettings = {
            ...settings,
            models: settings.models.filter(m => m.title !== title),
            activeOCRModel: settings.activeOCRModel === title ? '' : settings.activeOCRModel,
            activeSolvingModel: settings.activeSolvingModel === title ? '' : settings.activeSolvingModel,
        };
        saveSettings(newSettings);
    };

    const handleExportSettings = async () => {
        try {
            const settingsStr = JSON.stringify(settings, null, 2);

            if (Platform.OS === 'web') {
                // Web平台：创建下载链接
                const blob = new Blob([settingsStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'model-settings.json';
                a.click();
                URL.revokeObjectURL(url);
            } else {
                // 移动平台：使用分享功能
                const result = await Share.share({
                    message: settingsStr,
                    title: 'Model Settings'
                });

                if (result.action === Share.sharedAction) {
                    Alert.alert('成功', '配置已导出');
                }
            }
        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('错误', '导出配置失败');
        }
    };

    const handleImportSettings = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
            });

            if (result.canceled) {
                return;
            }

            console.log('result', result);

            let jsonContent: string;

            if (Platform.OS === 'web') {
                const response = await fetch(result.assets[0].uri);
                jsonContent = await response.text();
            } else {
                jsonContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
            }

            const importedSettings = JSON.parse(jsonContent);

            // 验证导入的数据结构
            if (!importedSettings.models || !Array.isArray(importedSettings.models)) {
                throw new Error('Invalid settings format');
            }
            await saveSettings(importedSettings);
            Alert.alert('成功', '配置已导入');
        } catch (error) {
            console.error('Import failed:', error);
            Alert.alert('错误', '导入配置失败');
        }
    };

    const setActiveModel = (modelTitle: string, type: 'ocr' | 'solving') => {
        const model = settings.models.find(m => m.title === modelTitle);
        if (!model) return;

        const newSettings = { ...settings };
        if (type === 'ocr') {
            newSettings.activeOCRModel = modelTitle;
        } else {
            newSettings.activeSolvingModel = modelTitle;
        }
        saveSettings(newSettings);
    };

    const renderModelEditor = () => (
        <ThemedView style={styles.modalContent}>
            <ThemedText type="subtitle">编辑模型</ThemedText>

            <TextInput
                style={styles.input}
                value={editingModel?.title}
                onChangeText={text => setEditingModel(prev => prev ? { ...prev, title: text } : null)}
                placeholder="模型名称"
                placeholderTextColor="#999"
            />

            <ThemedView style={styles.pickerContainer}>
                <ThemedText>类型：</ThemedText>
                {(['mm', 'vl', 'text'] as ModelType[]).map(type => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.typeButton,
                            editingModel?.type === type && styles.typeButtonActive
                        ]}
                        onPress={() => setEditingModel(prev => prev ? { ...prev, type } : null)}
                    >
                        <ThemedText>{getModelType(type)}</ThemedText>
                    </TouchableOpacity>
                ))}
            </ThemedView>

            <TextInput
                style={styles.input}
                value={editingModel?.model}
                onChangeText={text => setEditingModel(prev => prev ? { ...prev, model: text } : null)}
                placeholder="模型ID"
                placeholderTextColor="#999"
            />

            <TextInput
                style={styles.input}
                value={editingModel?.apiBase}
                onChangeText={text => setEditingModel(prev => prev ? { ...prev, apiBase: text } : null)}
                placeholder="API地址"
                placeholderTextColor="#999"
            />

            <TextInput
                style={styles.input}
                value={editingModel?.apiKey}
                onChangeText={text => setEditingModel(prev => prev ? { ...prev, apiKey: text } : null)}
                placeholder="API密钥"
                placeholderTextColor="#999"
                secureTextEntry
            />

            <ThemedView style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={() => setIsEditing(false)}>
                    <ThemedText>取消</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSaveModel}>
                    <ThemedText style={styles.primaryButtonText}>保存</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        </ThemedView>
    );

    function renderImageHostConfig() {
        return (
            <ThemedView style={styles.section}>
                <ThemedText style={styles.sectionTitle}>图床配置</ThemedText>
                <ThemedView style={styles.modelCard}>
                    <ThemedView style={styles.settingItem}>
                        <ThemedText>类型</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={settings.imageHost.type}
                            onChangeText={(text) => {
                                const newSettings = { ...settings };
                                newSettings.imageHost.type = text;
                                saveSettings(newSettings);
                            }}
                            placeholder="图床类型 (imgbb)"
                        />
                    </ThemedView>
                    <ThemedView style={styles.settingItem}>
                        <ThemedText>API Key</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={settings.imageHost.apiKey}
                            onChangeText={(text) => {
                                const newSettings = { ...settings };
                                newSettings.imageHost.apiKey = text;
                                saveSettings(newSettings);
                            }}
                            placeholder="图床API Key"
                            secureTextEntry
                        />
                    </ThemedView>
                </ThemedView>
            </ThemedView>
        );
    }

    return (
        <>
            <ScrollView style={styles.container}>
                <ThemedView style={styles.header}>
                    <ThemedText type="title">设置</ThemedText>
                    <ThemedView style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={handleImportSettings}
                        >
                            <IconSymbol size={20} name="square.and.arrow.down" color="#007AFF" />
                            <ThemedText style={styles.headerButtonText}>导入</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerButton}
                            onPress={handleExportSettings}
                        >
                            <IconSymbol size={20} name="square.and.arrow.up" color="#007AFF" />
                            <ThemedText style={styles.headerButtonText}>导出</ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </ThemedView>

                <ThemedView style={styles.section}>
                    <ThemedText type="subtitle">模型配置</ThemedText>
                    <TouchableOpacity
                        style={[styles.addButton, isEditing && styles.addButtonDisabled]}
                        onPress={handleAddModel}
                        disabled={isEditing}
                    >
                        <IconSymbol size={24} name="plus.circle.fill" color={isEditing ? '#999' : '#007AFF'} />
                        <ThemedText style={[styles.addButtonText, isEditing && styles.addButtonTextDisabled]}>
                            添加模型
                        </ThemedText>
                    </TouchableOpacity>

                    {settings.models.map((model, index) => (
                        <ThemedView key={`${model.title}-${index}`} style={styles.modelCard}>
                            <ThemedView style={styles.modelHeader}>
                                <ThemedText type="defaultSemiBold">{model.title}</ThemedText>
                                <ThemedView style={styles.modelActions}>
                                    <TouchableOpacity
                                        onPress={() => handleEditModel(model)}
                                        style={styles.actionButton}
                                    >
                                        <IconSymbol size={20} name="pencil" color="#007AFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteModel(model.title)}
                                        style={styles.actionButton}
                                    >
                                        <IconSymbol size={20} name="trash" color="#FF3B30" />
                                    </TouchableOpacity>
                                </ThemedView>
                            </ThemedView>
                            <ThemedText>类型: {getModelType(model.type)}</ThemedText>
                            <ThemedText>模型: {model.model}</ThemedText>
                            <ThemedText>API地址: {model.apiBase}</ThemedText>
                        </ThemedView>
                    ))}
                </ThemedView>

                <ThemedView style={styles.section}>
                    <ThemedText type="subtitle">使用配置</ThemedText>

                    <ThemedView style={styles.settingItem}>
                        <ThemedText>题目识别模型</ThemedText>
                        <ThemedView style={styles.modelSelector}>
                            {settings.models
                                .filter(m => ['mm', 'vl'].includes(m.type))
                                .map(model => (
                                    <TouchableOpacity
                                        key={model.title}
                                        style={[
                                            styles.modelOption,
                                            settings.activeOCRModel === model.title && styles.modelOptionActive
                                        ]}
                                        onPress={() => setActiveModel(model.title, 'ocr')}
                                    >
                                        <ThemedText>{model.title}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                        </ThemedView>
                    </ThemedView>

                    <ThemedView style={styles.settingItem}>
                        <ThemedText>解题模型</ThemedText>
                        <ThemedView style={styles.modelSelector}>
                            {settings.models
                                .filter(m => ['mm', 'text'].includes(m.type))
                                .map(model => (
                                    <TouchableOpacity
                                        key={model.title}
                                        style={[
                                            styles.modelOption,
                                            settings.activeSolvingModel === model.title && styles.modelOptionActive
                                        ]}
                                        onPress={() => setActiveModel(model.title, 'solving')}
                                    >
                                        <ThemedText>{model.title}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                        </ThemedView>
                    </ThemedView>
                </ThemedView>

                {renderImageHostConfig()}
            </ScrollView>

            {isEditing && (
                <ThemedView style={styles.modalOverlay}>
                    <ThemedView style={styles.modalContent}>
                        {renderModelEditor()}
                    </ThemedView>
                </ThemedView>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        marginTop: 60,
        marginHorizontal: 20,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        backgroundColor: '#F0F0F0',
        borderRadius: 8,
    },
    headerButtonText: {
        color: '#007AFF',
        fontSize: 14,
    },
    section: {
        padding: 20,
        gap: 16,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#F0F0F0',
        borderRadius: 8,
    },
    addButtonText: {
        color: '#007AFF',
    },
    modelCard: {
        padding: 16,
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        gap: 8,
    },
    modelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modelActions: {
        flexDirection: 'row',
        gap: 16,
        padding: 4,
    },
    settingItem: {
        gap: 8,
    },
    modelSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modelOption: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    modelOptionActive: {
        backgroundColor: '#007AFF',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        gap: 16,
    },
    input: {
        padding: 12,
        backgroundColor: '#F0F0F0',
        borderRadius: 8,
        fontSize: 16,
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typeButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    typeButtonActive: {
        backgroundColor: '#007AFF',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    button: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
    },
    primaryButtonText: {
        color: '#FFFFFF',
    },
    addButtonDisabled: {
        opacity: 0.5,
    },
    addButtonTextDisabled: {
        color: '#999',
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
        minWidth: 40,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
}); 