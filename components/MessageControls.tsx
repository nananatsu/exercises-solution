import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { IconSymbol } from './ui/IconSymbol';

interface MessageControlsProps {
    position: number;
    version: number;
    totalVersions: number;
    onEdit?: () => void;
    onRefresh?: () => void;
    onSwitch?: (version: number) => void;
}

export function MessageControls({
    position,
    version,
    totalVersions,
    onEdit,
    onRefresh,
    onSwitch
}: MessageControlsProps) {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                {onEdit && (
                    <TouchableOpacity style={styles.button} onPress={onEdit}>
                        <IconSymbol name="edit" size={16} />
                        <ThemedText style={styles.buttonText}>修改</ThemedText>
                    </TouchableOpacity>
                )}
                {onRefresh && (
                    <TouchableOpacity style={styles.button} onPress={onRefresh}>
                        <IconSymbol name="refresh" size={16} />
                        <ThemedText style={styles.buttonText}>重新生成</ThemedText>
                    </TouchableOpacity>
                )}
            </View>
            {totalVersions > 1 && (
                <TouchableOpacity 
                    style={styles.versionButton}
                    onPress={() => {
                        const nextVersion = (version + 1) % totalVersions;
                        onSwitch?.(nextVersion);
                    }}
                >
                    <ThemedText style={styles.versionText}>
                        {version + 1}/{totalVersions}
                    </ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 8,
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        gap: 4,
    },
    buttonText: {
        fontSize: 12,
    },
    versionButton: {
        alignSelf: 'flex-start',
        padding: 4,
        borderRadius: 4,
        backgroundColor: '#e0e0e0',
    },
    versionText: {
        fontSize: 12,
        color: '#666',
    },
}); 