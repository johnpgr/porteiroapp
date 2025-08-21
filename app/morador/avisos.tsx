import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ProtectedRoute from '~/components/ProtectedRoute';
import { flattenStyles } from '~/utils/styles';

type Notice = {
  id: string;
  title: string;
  description: string;
  category: 'maintenance' | 'event' | 'warning' | 'info' | 'emergency';
  date: string;
  time: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  author: string;
};

// TODO: Carregar avisos reais do Supabase
// const mockNotices: Notice[] = [];

export default function Avisos() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Carregar avisos do Supabase
    // const avisos = await getAvisosCondominio();
    // setNotices(avisos);
    setRefreshing(false);
  };

  const markAsRead = (noticeId: string) => {
    setNotices((prev) =>
      prev.map((notice) => (notice.id === noticeId ? { ...notice, isRead: true } : notice))
    );
  };

  const markAllAsRead = () => {
    Alert.alert('Marcar Todos como Lidos', 'Deseja marcar todos os avisos como lidos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          setNotices((prev) => prev.map((notice) => ({ ...notice, isRead: true })));
        },
      },
    ]);
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      maintenance: '🔧',
      event: '🎉',
      warning: '⚠️',
      info: 'ℹ️',
      emergency: '🚨',
    };
    return icons[category] || 'ℹ️';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      maintenance: '#FF9800',
      event: '#4CAF50',
      warning: '#F44336',
      info: '#2196F3',
      emergency: '#E91E63',
    };
    return colors[category] || '#2196F3';
  };

  const getPriorityColor = (priority: string) => {
    const colors: { [key: string]: string } = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336',
    };
    return colors[priority] || '#4CAF50';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  };

  const filteredNotices =
    selectedCategory === 'all'
      ? notices
      : notices.filter((notice) => notice.category === selectedCategory);

  const unreadCount = notices.filter((notice) => !notice.isRead).length;

  const categories = [
    { id: 'all', label: 'Todos', icon: '📋' },
    { id: 'maintenance', label: 'Manutenção', icon: '🔧' },
    { id: 'event', label: 'Eventos', icon: '🎉' },
    { id: 'warning', label: 'Avisos', icon: '⚠️' },
    { id: 'info', label: 'Informações', icon: 'ℹ️' },
    { id: 'emergency', label: 'Emergência', icon: '🚨' },
  ];

  return (
    <ProtectedRoute redirectTo="/morador/login" userType="morador">
      <SafeAreaView style={styles.container}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.title}>📢 Avisos</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
              <Ionicons name="checkmark-done" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.categoriesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}>
              {categories.map((category) => {
                const categoryCount =
                  category.id === 'all'
                    ? notices.length
                    : notices.filter((n) => n.category === category.id).length;

                return (
                  <TouchableOpacity
                    key={category.id}
                    style={flattenStyles([
                      styles.categoryButton,
                      selectedCategory === category.id && styles.categoryButtonActive,
                    ])}
                    onPress={() => setSelectedCategory(category.id)}>
                    <Text
                      style={flattenStyles([
                        styles.categoryIcon,
                        selectedCategory === category.id && styles.categoryIconActive,
                      ])}>
                      {category.icon}
                    </Text>
                    <Text
                      style={flattenStyles([
                        styles.categoryLabel,
                        selectedCategory === category.id && styles.categoryLabelActive,
                      ])}>
                      {category.label}
                    </Text>
                    {categoryCount > 0 && (
                      <View
                        style={flattenStyles([
                          styles.categoryBadge,
                          selectedCategory === category.id && styles.categoryBadgeActive,
                        ])}>
                        <Text
                          style={flattenStyles([
                            styles.categoryBadgeText,
                            selectedCategory === category.id && styles.categoryBadgeTextActive,
                          ])}>
                          {categoryCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {filteredNotices.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>Nenhum aviso encontrado</Text>
                <Text style={styles.emptyDescription}>
                  {selectedCategory === 'all'
                    ? 'Não há avisos para exibir no momento.'
                    : `Não há avisos na categoria "${categories.find((c) => c.id === selectedCategory)?.label}".`}
                </Text>
              </View>
            ) : (
              <View style={styles.noticesList}>
                {filteredNotices.map((notice) => (
                  <TouchableOpacity
                    key={notice.id}
                    style={flattenStyles([
                      styles.noticeCard,
                      !notice.isRead && styles.noticeCardUnread,
                    ])}
                    onPress={() => markAsRead(notice.id)}>
                    <View style={styles.noticeHeader}>
                      <View style={styles.noticeCategory}>
                        <Text style={styles.noticeCategoryIcon}>
                          {getCategoryIcon(notice.category)}
                        </Text>
                        <View
                          style={flattenStyles([
                            styles.noticePriority,
                            { backgroundColor: getPriorityColor(notice.priority) },
                          ])}
                        />
                      </View>

                      <View style={styles.noticeInfo}>
                        <Text style={styles.noticeDate}>
                          {formatDate(notice.date)} • {notice.time}
                        </Text>
                        <Text style={styles.noticeAuthor}>por {notice.author}</Text>
                      </View>

                      {!notice.isRead && <View style={styles.unreadIndicator} />}
                    </View>

                    <View style={styles.noticeContent}>
                      <Text
                        style={flattenStyles([
                          styles.noticeTitle,
                          !notice.isRead && styles.noticeTitleUnread,
                        ])}>
                        {notice.title}
                      </Text>
                      <Text style={styles.noticeDescription}>{notice.description}</Text>
                    </View>

                    <View style={styles.noticeFooter}>
                      <View
                        style={flattenStyles([
                          styles.categoryTag,
                          { backgroundColor: getCategoryColor(notice.category) + '20' },
                        ])}>
                        <Text
                          style={flattenStyles([
                            styles.categoryTagText,
                            { color: getCategoryColor(notice.category) },
                          ])}>
                          {categories.find((c) => c.id === notice.category)?.label ||
                            notice.category}
                        </Text>
                      </View>

                      <TouchableOpacity style={styles.shareButton}>
                        <Ionicons name="share-outline" size={16} color="#666" />
                        <Text style={styles.shareText}>Compartilhar</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllButton: {
    padding: 8,
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoriesList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryIconActive: {
    // Icon stays the same
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  categoryLabelActive: {
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  categoryBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  categoryBadgeTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  noticesList: {
    gap: 16,
  },
  noticeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  noticeCardUnread: {
    borderLeftColor: '#2196F3',
    backgroundColor: '#f8fffe',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noticeCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  noticeCategoryIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  noticePriority: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeDate: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  noticeAuthor: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  noticeContent: {
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  noticeTitleUnread: {
    color: '#1976D2',
  },
  noticeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noticeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryTag: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  shareText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});
