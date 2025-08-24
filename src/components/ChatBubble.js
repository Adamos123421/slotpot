import React from 'react';
import { MessageCircle } from 'lucide-react';
import './ChatBubble.css';

const ChatBubble = ({ telegramGroupUrl = "https://t.me/yumeonton" }) => {
  const handleClick = () => {
    window.open(telegramGroupUrl, '_blank');
  };

  return (
    <div className="chat-bubble" onClick={handleClick}>
      <MessageCircle size={20} className="chat-icon" />
      <span className="chat-text">Join Chat</span>
    </div>
  );
};

export default ChatBubble;
