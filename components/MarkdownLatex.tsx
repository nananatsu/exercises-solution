import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import KatexView from 'react-native-katex';
import { ThemedText } from '@/components/ThemedText';

interface MarkdownLatexProps {
    content: string;
    textColor?: string;
    baseStyles?: Record<string, any>;
}

interface MarkdownNode {
    key: string;
    content: string;
    sourceInfo?: string;
}

interface MarkdownState {
    key: string;
}

export function MarkdownLatex({ content, textColor = '#000000', baseStyles = {} }: MarkdownLatexProps) {
    const preprocessContent = (text: string) => {
        // 替换各种LaTeX分隔符为统一格式
        text = text
            .replace(/\\\\\[/g, '\n$$') // Replace '\\[' with newline + '$$'
            .replace(/\\\\\]/g, '$$\n') // Replace '\\]' with '$$' + newline
            .replace(/\\\\\(/g, '$') // Replace '\\(' with '$'
            .replace(/\\\\\)/g, '$') // Replace '\\)' with '$'
            .replace(/\\\[/g, '\n$$') // Replace '\[' with newline + '$$'
            .replace(/\\\]/g, '$$\n') // Replace '\]' with '$$' + newline
            .replace(/\\\(/g, '$') // Replace '\(' with '$'
            .replace(/\\\)/g, '$'); // Replace '\)' with '$'

        // 处理多行公式块 $$ ... $$
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
            return `\n\`\`\`math\n${formula.trim()}\n\`\`\`\n`;
        });

        // 处理行内公式 $ ... $，但排除已处理的 $$
        text = text.replace(/(?<!\$)\$(?!\$)(.*?[^$])\$(?!\$)/g, (_, formula) => {
            return `\`$${formula}$\``;
        });

        return text;
    };

    const renderKatex = (formula: string, displayMode: boolean, key: string) => (
        <View key={key} style={displayMode ? styles.blockMathContainer : styles.inlineMathContainer}>
            <KatexView
                expression={formula}
                displayMode={displayMode}
                throwOnError={false}
                errorColor="#ff0000"
                inlineStyle={displayMode ? undefined : { margin: 0, padding: 0 }}
                style={displayMode ? { margin: 8, alignSelf: 'center' } : undefined}
                renderError={(error: Error) => (
                    <ThemedText style={styles.errorText}>
                        {error.message}
                    </ThemedText>
                )}
                // 明确设置所有可能的props
                fontSize={16}
                letterSpacing={0}
                baseColor={textColor}
                textAlign="center"
            />
        </View>
    );

    const defaultStyles = {
        body: [styles.markdownBody, { color: textColor }],
        paragraph: styles.paragraph,
        fence: styles.codeBlock,
        code_inline: styles.inlineCode,
        link: styles.link,
        ...baseStyles,
    };

    return (
        <Markdown
            style={defaultStyles}
            rules={{
                code_inline: (node: MarkdownNode, _: any, state: MarkdownState) => {
                    if (node.content.startsWith('$') && node.content.endsWith('$')) {
                        const formula = node.content.slice(1, -1);
                        return renderKatex(formula, false, node.key || state.key);
                    }
                    return (
                        <ThemedText key={node.key || state.key} style={styles.inlineCode}>
                            {node.content}
                        </ThemedText>
                    );
                },
                fence: (node: MarkdownNode, _: any, state: MarkdownState) => {
                    if (node.sourceInfo === 'math') {
                        return renderKatex(node.content, true, node.key || state.key);
                    }
                    return (
                        <ThemedText key={node.key || state.key} style={styles.codeBlock}>
                            {node.content}
                        </ThemedText>
                    );
                },
            }}
        >
            {preprocessContent(content)}
        </Markdown>
    );
}

const styles = StyleSheet.create({
    markdownBody: {
        flex: 1,
    },
    paragraph: {
        marginVertical: 4,
    },
    codeBlock: {
        backgroundColor: '#f0f0f0',
        padding: 8,
        borderRadius: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    inlineCode: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 2,
        borderRadius: 3,
    },
    link: {
        color: '#007AFF',
        textDecorationLine: 'underline',
    },
    blockMathContainer: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 8,
    },
    inlineMathContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        color: '#ff0000',
        fontSize: 12,
    },
}); 