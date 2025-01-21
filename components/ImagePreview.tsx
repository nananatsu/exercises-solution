import { Modal, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { Image } from 'react-native';

interface ImagePreviewProps {
    visible: boolean;
    imageUri: string;
    onClose: () => void;
}

export function ImagePreview({ visible, imageUri, onClose }: ImagePreviewProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <ThemedView style={styles.overlay}>
                <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={onClose}
                >
                    <IconSymbol name="xmark.circle.fill" size={30} color="#fff" />
                </TouchableOpacity>
                
                <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="contain"
                />
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
    },
}); 