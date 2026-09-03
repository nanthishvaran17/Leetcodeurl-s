import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'alert' | 'assignment' | 'system';
  priority: 'low' | 'normal' | 'high';
  recipientUserId: string;
  createdAt: any;
  isRead: boolean;
  actionRoute?: string;
  createdBy?: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (!isAuthenticated || !user || !user.email || !db) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    // We assume the target ID is the user email (as set up in backend)
    const targetUserId = user.email;
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientUserId', '==', targetUserId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      // Sort manually since we might need a composite index for orderBy with where
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      
      setNotifications(fetched);
      setUnreadCount(fetched.filter(n => !n.isRead).length);
    }, (error) => {
      console.error("Error fetching notifications:", error);
    });
    
    return () => unsubscribe();
  }, [user, isAuthenticated]);
  
  const markAsRead = async (notificationId: string) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, { isRead: true });
    } catch (err) {
      console.error("Error marking as read", err);
    }
  };
  
  const markAllAsRead = async () => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      const unreadNotifs = notifications.filter(n => !n.isRead);
      unreadNotifs.forEach(n => {
        const docRef = doc(db, 'notifications', n.id);
        batch.update(docRef, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read", err);
    }
  };
  
  const deleteNotification = async (notificationId: string) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting notification", err);
    }
  };
  
  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
};
