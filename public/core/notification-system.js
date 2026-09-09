// Notification System - COMPLETELY FIXED - No Duplicates, No Spam
class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 3; // Reduced from 5
        this.defaultDuration = 3000;
        this.container = null;
        
        // 🔥 PREVENT DUPLICATE NOTIFICATIONS
        this.activeNotifications = new Map(); // Track active notifications by key
        
        this.init();
    }

    init() {
        this.createContainer();
        this.bindElements();
    }

    createContainer() {
        this.container = document.getElementById('notification-container');
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }
    }

    bindElements() {
        this.container = document.getElementById('notification-container');
    }

    show(type = 'info', title = '', message = '', duration = null) {
        if (!this.container) {
            console.warn('[Notification] Container not found');
            return;
        }

        // 🔥 CREATE UNIQUE KEY to prevent duplicates
        const notificationKey = `${type}-${title}-${message}`;
        
        // 🔥 CHECK if this notification is already showing
        if (this.activeNotifications.has(notificationKey)) {
            console.log('[Notification] Duplicate prevented:', notificationKey);
            return; // Don't show duplicate
        }

        // Clean up old notifications
        this.cleanupOldNotifications();

        const notification = this.createNotification(type, title, message, duration);
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // 🔥 TRACK this notification
        this.activeNotifications.set(notificationKey, notification);

        // Auto-hide after duration
        const hideDelay = duration || this.defaultDuration;
        setTimeout(() => {
            this.hide(notification, notificationKey);
        }, hideDelay);

        return notification;
    }

    createNotification(type, title, message, duration) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = this.getIcon(type);
        
        notification.innerHTML = `
            <button class="notification-close" aria-label="Close notification">&times;</button>
            <div class="notification-header">
                <span class="notification-icon">${icon}</span>
                <span class="notification-title">${title}</span>
            </div>
            <div class="notification-message">${message}</div>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            const notificationKey = `${type}-${title}-${message}`;
            this.hide(notification, notificationKey);
        });

        return notification;
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            inventory: '🎒',
            coins: '💰',
            book: '📚',
            pen: '✏️',
            ink: '🖋️'
        };
        
        return icons[type] || icons.info;
    }

    hide(notification, notificationKey = null) {
        if (!notification || !notification.parentNode) return;

        // 🔥 REMOVE from active tracking
        if (notificationKey) {
            this.activeNotifications.delete(notificationKey);
        }

        notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }

    cleanupOldNotifications() {
        while (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications[0];
            this.hide(oldest);
        }
    }

    hideAll() {
        const notificationsToHide = [...this.notifications];
        notificationsToHide.forEach(notification => this.hide(notification));
        this.activeNotifications.clear();
    }

    // 🔥 REMOVED ALL GAME-SPECIFIC METHODS
    // showInventoryFull, showItemAdded, showItemUsed, etc. - ALL REMOVED
    // These were causing spam and duplicates
}

// Initialize notification system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.NotificationSystem = new NotificationSystem();
    console.log('[Notification] System initialized');
});

window.NotificationSystem = NotificationSystem;