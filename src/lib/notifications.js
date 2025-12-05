export const addNotification = async (userId, message, type = 'info') => {
    const { error } = await supabase.from('notifications').insert([
        { user_id: userId, message, type, is_read: false }
    ]);
    if (error) console.error('Notification error:', error);
};
