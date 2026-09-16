/**
 * Real-time Socket.IO Chat Application
 * Client Logic & State Engine (Correct Status Labels for Incoming/Outgoing File Transfers)
 */

(function () {
  'use strict';

  const CHUNK_SIZE = 64 * 1024; // 64 KB chunks

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    currentUser: {
      userId: null, // email
      name: '',
      email: '',
      avatar: '', // Base64 data URL
      socketId: null
    },
    socket: null,
    users: new Map(), // socketId -> user
    usersByEmail: new Map(), // email -> user
    rooms: new Map(), // roomName -> room
    activeChat: {
      type: null, // 'user' | 'room' | null
      targetId: null, // socketId or roomName
      targetEmail: null,
      targetName: ''
    },
    unreadCounts: new Map(), // targetId -> count
    chatLogs: new Map(), // targetId -> array of message objects
    avatarBase64: '',
    isConnected: false,

    // File Transfer State
    activeUploads: new Map(), // uploadId -> { file, chunkSize, chunkIndex, totalChunks, receiverId }
    activeDownloads: new Map() // uploadId -> { chunks, receivedBytes, fileSize, fileName, fileType, senderId }
  };

  // --------------------------------------------------------------------------
  // DOM Elements Reference
  // --------------------------------------------------------------------------
  const DOM = {
    loginView: document.getElementById('login-view'),
    chatView: document.getElementById('chat-view'),

    // Login Form Elements
    loginForm: document.getElementById('login-form'),
    avatarWrapper: document.getElementById('avatar-preview-wrapper'),
    avatarInput: document.getElementById('avatar-file-input'),
    avatarPreview: document.getElementById('avatar-preview-img'),
    avatarPlaceholder: document.getElementById('avatar-placeholder'),
    avatarBadge: document.getElementById('avatar-badge'),
    avatarError: document.getElementById('avatar-error'),
    
    nameInput: document.getElementById('user-name'),
    nameError: document.getElementById('name-error'),
    
    emailInput: document.getElementById('user-email'),
    emailError: document.getElementById('email-error'),
    
    loginBtn: document.getElementById('login-submit-btn'),

    // Chat Screen Elements
    myAvatar: document.getElementById('my-avatar'),
    myName: document.getElementById('my-name'),
    myEmail: document.getElementById('my-email'),
    logoutBtn: document.getElementById('logout-btn'),

    // Sidebar
    tabUsersBtn: document.getElementById('tab-users'),
    tabRoomsBtn: document.getElementById('tab-rooms'),
    searchSidebar: document.getElementById('sidebar-search-input'),
    sidebarUserList: document.getElementById('sidebar-user-list'),
    sidebarRoomList: document.getElementById('sidebar-room-list'),
    createRoomBtn: document.getElementById('open-create-room-modal'),

    // Main Chat Window
    chatHeaderTitle: document.getElementById('active-chat-title'),
    chatHeaderSub: document.getElementById('active-chat-sub'),
    chatHeaderAvatar: document.getElementById('active-chat-avatar'),
    chatHeaderAvatarWrap: document.getElementById('active-chat-avatar-wrap'),
    messagesArea: document.getElementById('messages-area'),
    emptyChatState: document.getElementById('empty-chat-state'),
    
    // Message Composer
    chatInputForm: document.getElementById('chat-input-form'),
    messageInput: document.getElementById('message-text-input'),
    fileInput: document.getElementById('file-attachment-input'),
    fileAttachBtn: document.getElementById('file-attach-btn'),
    sendBtn: document.getElementById('send-msg-btn'),

    // Modals
    createRoomModal: document.getElementById('create-room-modal'),
    roomNameInput: document.getElementById('new-room-name'),
    confirmCreateRoomBtn: document.getElementById('confirm-create-room-btn'),
    cancelCreateRoomBtn: document.getElementById('cancel-create-room-btn'),
    closeRoomModalBtn: document.getElementById('close-room-modal')
  };

  // Helper: Generate Avatar SVG Data URL
  function generateDefaultAvatar(name) {
    const initials = name ? name.trim().slice(0, 2).toUpperCase() : 'U';
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#7367f0';
    ctx.beginPath();
    ctx.arc(60, 60, 60, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Public Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 60, 64);

    return canvas.toDataURL('image/png');
  }

  // --------------------------------------------------------------------------
  // Validation Logic
  // --------------------------------------------------------------------------

  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email).toLowerCase());
  }

  function validateName(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 50;
  }

  function validateForm() {
    let isValid = true;

    const nameVal = DOM.nameInput.value.trim();
    if (!nameVal) {
      DOM.nameError.textContent = '';
      DOM.nameInput.classList.remove('is-valid', 'is-invalid');
      isValid = false;
    } else if (!validateName(nameVal)) {
      DOM.nameError.textContent = 'Name must be between 2 and 50 characters';
      DOM.nameInput.classList.add('is-invalid');
      DOM.nameInput.classList.remove('is-valid');
      isValid = false;
    } else {
      DOM.nameError.textContent = '';
      DOM.nameInput.classList.remove('is-invalid');
      DOM.nameInput.classList.add('is-valid');
    }

    const emailVal = DOM.emailInput.value.trim();
    if (!emailVal) {
      DOM.emailError.textContent = '';
      DOM.emailInput.classList.remove('is-valid', 'is-invalid');
      isValid = false;
    } else if (!validateEmail(emailVal)) {
      DOM.emailError.textContent = 'Please enter a valid email address';
      DOM.emailInput.classList.add('is-invalid');
      DOM.emailInput.classList.remove('is-valid');
      isValid = false;
    } else {
      DOM.emailError.textContent = '';
      DOM.emailInput.classList.remove('is-invalid');
      DOM.emailInput.classList.add('is-valid');
    }

    DOM.loginBtn.disabled = !isValid;
    return isValid;
  }

  // Avatar Upload
  DOM.avatarWrapper.addEventListener('click', () => DOM.avatarInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    DOM.avatarWrapper.addEventListener(eventName, (e) => {
      e.preventDefault();
      DOM.avatarWrapper.style.borderColor = '#655bd3';
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    DOM.avatarWrapper.addEventListener(eventName, (e) => {
      e.preventDefault();
      DOM.avatarWrapper.style.borderColor = '#7367f0';
    });
  });

  DOM.avatarWrapper.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleAvatarFile(files[0]);
  });

  DOM.avatarInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleAvatarFile(e.target.files[0]);
  });

  function handleAvatarFile(file) {
    DOM.avatarError.textContent = '';
    if (!file.type.startsWith('image/')) {
      DOM.avatarError.textContent = 'File must be an image (PNG, JPG, WEBP)';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      DOM.avatarError.textContent = 'Image size must be under 5MB';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (evt) {
      state.avatarBase64 = evt.target.result;
      DOM.avatarPreview.src = state.avatarBase64;
      DOM.avatarPreview.style.display = 'block';
      DOM.avatarPlaceholder.style.display = 'none';
      DOM.avatarBadge.textContent = 'Base64 Encoded';
      validateForm();
    };
    reader.readAsDataURL(file);
  }

  DOM.nameInput.addEventListener('input', validateForm);
  DOM.emailInput.addEventListener('input', validateForm);

  function showView(viewName) {
    if (viewName === 'login') {
      DOM.loginView.classList.add('active');
      DOM.chatView.classList.remove('active');
    } else if (viewName === 'chat') {
      DOM.loginView.classList.remove('active');
      DOM.chatView.classList.add('active');
    }
  }

  // --------------------------------------------------------------------------
  // Socket.IO Connection & Protocol Setup
  // --------------------------------------------------------------------------

  function initSocketConnection() {
    if (typeof io === 'undefined') {
      alert('Socket.IO client library failed to load.');
      return;
    }

    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isLocalDev && window.location.port === '8080' 
      ? 'http://localhost:3000' 
      : window.location.origin;

    console.log('[Socket] Connecting to:', serverUrl);

    state.socket = io(serverUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    bindSocketEvents();
  }

  function bindSocketEvents() {
    const socket = state.socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected! Socket ID:', socket.id);
      state.isConnected = true;
      state.currentUser.socketId = socket.id;

      socket.emit('ready', {
        userId: state.currentUser.email,
        name: state.currentUser.name,
        email: state.currentUser.email,
        avatar: state.currentUser.avatar
      });

      socket.emit('allUser');
      socket.emit('getRooms');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      state.isConnected = false;
    });

    socket.on('getSocketId', (data) => {
      if (data && data.id) state.currentUser.socketId = data.id;
    });

    socket.on('ready', (userData) => {
      console.log('[Socket] Server ready ack:', userData);
      showView('chat');
    });

    socket.on('userJoined', (user) => {
      if (user && user.id && user.id !== state.currentUser.socketId) {
        user.userId = user.userId || user.email || user.id;
        state.users.set(user.id, user);
        state.usersByEmail.set(user.userId, user);
        renderSidebarUsers();
      }
    });

    socket.on('userLeft', (user) => {
      if (user && user.id) {
        const userIdKey = user.userId || user.email || user.id;
        state.users.delete(user.id);
        state.usersByEmail.delete(userIdKey);
        renderSidebarUsers();
      }
    });

    socket.on('userList', (userList) => {
      state.users.clear();
      state.usersByEmail.clear();
      userList.forEach(user => {
        if (user.id && user.id !== state.currentUser.socketId) {
          user.userId = user.userId || user.email || user.id;
          state.users.set(user.id, user);
          state.usersByEmail.set(user.userId, user);
        }
      });
      renderSidebarUsers();
    });

    socket.on('allRooms', (roomList) => {
      state.rooms.clear();
      roomList.forEach(r => state.rooms.set(r.roomName, r));
      renderSidebarRooms();
    });

    socket.on('roomCreated', (data) => {
      socket.emit('getRooms');
      selectChatTarget('room', data.roomName, `# ${data.roomName}`);
    });

    socket.on('roomJoined', (data) => socket.emit('getRooms'));
    socket.on('roomLeft', (data) => socket.emit('getRooms'));

    socket.on('message', (data) => {
      console.log('[Socket] Incoming private message:', data);
      handleIncomingMessage(data, 'user');
    });

    socket.on('roomMessage', (data) => {
      console.log('[Socket] Incoming room message:', data);
      handleIncomingMessage(data, 'room');
    });

    // ----------------------------------------------------------------------
    // Single Chunked File Transfer Protocol
    // ----------------------------------------------------------------------

    socket.on('fileStart', (data) => {
      console.log('[FileTransfer] Incoming fileStart:', data);
      const { uploadId, senderId, fileName, fileSize, fileType } = data;
      
      state.activeDownloads.set(uploadId, {
        uploadId,
        senderId,
        fileName,
        fileSize,
        fileType,
        chunks: [],
        receivedBytes: 0
      });

      const senderUser = state.usersByEmail.get(senderId) || { name: senderId, id: senderId };
      const senderSocketId = senderUser.id;

      // Incoming File Status Label: "Receiving file: ..."
      const msgObj = {
        id: uploadId,
        senderId: senderSocketId,
        senderName: senderUser.name || senderId,
        senderAvatar: senderUser.avatar || generateDefaultAvatar(senderUser.name),
        text: `Receiving file: ${fileName}`,
        isFile: true,
        uploadId: uploadId,
        fileName: fileName,
        fileSize: fileSize,
        progress: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOutgoing: false
      };

      const targetKey = senderSocketId;
      if (!state.chatLogs.has(targetKey)) state.chatLogs.set(targetKey, []);
      state.chatLogs.get(targetKey).push(msgObj);

      if (state.activeChat.targetId === targetKey) {
        appendMessageToDOM(msgObj);
      } else {
        const unread = state.unreadCounts.get(targetKey) || 0;
        state.unreadCounts.set(targetKey, unread + 1);
        renderSidebarUsers();
      }
    });

    socket.on('fileStartAck', (data) => {
      console.log('[FileTransfer] fileStartAck received:', data);
      const { uploadId, chunkSize } = data;
      const transfer = state.activeUploads.get(uploadId);
      if (!transfer) return;

      transfer.chunkSize = Math.min(chunkSize || CHUNK_SIZE, CHUNK_SIZE);
      transfer.chunkIndex = 0;
      transfer.totalChunks = Math.ceil(transfer.file.size / transfer.chunkSize);

      sendNextChunk(uploadId);
    });

    socket.on('fileChunk', (data) => {
      const { uploadId, chunkIndex, chunk } = data;
      const download = state.activeDownloads.get(uploadId);
      if (!download) return;

      const chunkSize = chunk.byteLength || chunk.length || (chunk.size ? chunk.size : 0);
      download.chunks[chunkIndex] = chunk;
      download.receivedBytes += chunkSize;

      const progress = Math.round((download.receivedBytes / download.fileSize) * 100);
      updateFileProgressUI(uploadId, progress);

      socket.emit('fileChunkReceived', {
        uploadId: uploadId,
        chunkIndex: chunkIndex,
        chunkSize: chunkSize
      });
    });

    socket.on('fileChunkAck', (data) => {
      const { uploadId, chunkIndex, progress } = data;
      const transfer = state.activeUploads.get(uploadId);
      if (!transfer) return;

      updateFileProgressUI(uploadId, progress);

      transfer.chunkIndex = chunkIndex + 1;
      if (transfer.chunkIndex < transfer.totalChunks) {
        sendNextChunk(uploadId);
      } else {
        socket.emit('fileEnd', { uploadId });
      }
    });

    socket.on('fileEnd', (data) => {
      console.log('[FileTransfer] Incoming fileEnd:', data);
      const { uploadId, fileName, fileType } = data;
      const download = state.activeDownloads.get(uploadId);
      if (!download) return;

      const blob = new Blob(download.chunks, { type: fileType || 'application/octet-stream' });
      const fileUrl = URL.createObjectURL(blob);

      updateFileCompleteUI(uploadId, fileUrl, fileType, fileName, false);
      state.activeDownloads.delete(uploadId);
    });

    socket.on('fileComplete', (data) => {
      console.log('[FileTransfer] Transfer completed on sender:', data);
      updateFileProgressUI(data.uploadId, 100);
      const transfer = state.activeUploads.get(data.uploadId);
      if (transfer) {
        updateFileCompleteUI(data.uploadId, null, transfer.file.type, transfer.file.name, true);
      }
      state.activeUploads.delete(data.uploadId);
    });

    socket.on('fileError', (data) => {
      console.error('[FileTransfer] Socket file error:', data);
      alert(`File transfer error: ${data.error}`);
    });
  }

  function sendNextChunk(uploadId) {
    const transfer = state.activeUploads.get(uploadId);
    if (!transfer) return;

    const start = transfer.chunkIndex * transfer.chunkSize;
    const end = Math.min(start + transfer.chunkSize, transfer.file.size);
    const blobChunk = transfer.file.slice(start, end);

    const reader = new FileReader();
    reader.onload = function (evt) {
      state.socket.emit('fileChunk', {
        uploadId: uploadId,
        chunkIndex: transfer.chunkIndex,
        chunk: evt.target.result
      });
    };
    reader.readAsArrayBuffer(blobChunk);
  }

  // --------------------------------------------------------------------------
  // Message Handling & UI Rendering
  // --------------------------------------------------------------------------

  function handleIncomingMessage(data, type) {
    const msg = data.message || data;
    const senderSocketId = data.senderId || msg.senderId;
    const roomName = data.roomName;
    
    const targetKey = type === 'room' ? roomName : senderSocketId;
    if (!targetKey) return;

    const messageObj = {
      id: Date.now() + Math.random(),
      senderId: senderSocketId,
      senderName: msg.senderName || 'User',
      senderAvatar: msg.senderAvatar || generateDefaultAvatar(msg.senderName),
      text: msg.text || '',
      image: msg.image || null,
      timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOutgoing: false
    };

    if (!state.chatLogs.has(targetKey)) state.chatLogs.set(targetKey, []);
    state.chatLogs.get(targetKey).push(messageObj);

    if (state.activeChat.targetId === targetKey) {
      appendMessageToDOM(messageObj);
    } else {
      const currentUnread = state.unreadCounts.get(targetKey) || 0;
      state.unreadCounts.set(targetKey, currentUnread + 1);
      renderSidebarUsers();
      renderSidebarRooms();
    }
  }

  function appendMessageToDOM(msg) {
    DOM.emptyChatState.style.display = 'none';

    const messageLi = document.createElement('li');
    messageLi.className = `chat-message list-unstyled ${msg.isOutgoing ? 'chat-message-right' : ''}`;
    if (msg.uploadId) messageLi.setAttribute('data-upload-id', msg.uploadId);

    const isOutgoing = msg.isOutgoing;
    const bubbleBg = isOutgoing ? '#7367f0' : '#f1f0f2';
    const textColor = isOutgoing ? '#ffffff' : '#33303c';

    messageLi.innerHTML = `
      <div class="d-flex overflow-hidden ${isOutgoing ? 'justify-content-end' : ''}">
        ${!isOutgoing ? `
          <div class="user-avatar flex-shrink-0 me-3">
            <div class="avatar avatar-sm" style="width:38px; height:38px;">
              <img src="${msg.senderAvatar}" alt="${msg.senderName}" class="rounded-circle" style="width:38px; height:38px; object-fit:cover;">
            </div>
          </div>
        ` : ''}

        <div class="chat-message-wrapper d-flex flex-column ${isOutgoing ? 'align-items-end' : 'align-items-start'}" style="max-width: 65%;">
          <div class="chat-message-text" style="background: ${bubbleBg}; color: ${textColor}; padding: 10px 16px; border-radius: 8px; display: inline-block; width: fit-content; max-width: 100%; word-break: break-word;">
            ${msg.text ? `<p class="mb-0 status-title-text">${msg.text}</p>` : ''}
            ${msg.image ? `
              <div class="mt-2">
                <img src="${msg.image}" class="img-fluid rounded" style="max-height: 250px; display: block;">
                <a href="${msg.image}" download="image_${Date.now()}.png" class="btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1">
                  <i class="icon-base ti tabler-download fs-6"></i> Download Image
                </a>
              </div>
            ` : ''}
            ${msg.isFile ? `
              <div class="p-2 rounded bg-white text-dark border mt-1">
                <div class="fw-semibold small">${msg.fileName}</div>
                <div class="small text-muted">${(msg.fileSize / 1024).toFixed(1)} KB</div>
                <div class="progress mt-1" style="height: 4px;">
                  <div class="progress-bar bg-success" id="progress-${msg.uploadId}" style="width: ${msg.progress || 0}%;"></div>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="text-body-secondary mt-1">
            <small>${msg.timestamp}</small>
          </div>
        </div>

        ${isOutgoing ? `
          <div class="user-avatar flex-shrink-0 ms-3">
            <div class="avatar avatar-sm" style="width:38px; height:38px;">
              <img src="${msg.senderAvatar}" alt="You" class="rounded-circle" style="width:38px; height:38px; object-fit:cover;">
            </div>
          </div>
        ` : ''}
      </div>
    `;

    DOM.messagesArea.appendChild(messageLi);
    DOM.messagesArea.scrollTop = DOM.messagesArea.scrollHeight;
  }

  function updateFileProgressUI(uploadId, progress) {
    const bar = document.getElementById(`progress-${uploadId}`);
    if (bar) bar.style.width = `${progress}%`;
  }

  function updateFileCompleteUI(uploadId, fileUrl, fileType, fileName, isOutgoing) {
    const bar = document.getElementById(`progress-${uploadId}`);
    if (bar) {
      bar.style.width = '100%';
      const messageTextDiv = bar.closest('.chat-message-text');
      if (messageTextDiv) {
        const titleElem = messageTextDiv.querySelector('.status-title-text');
        if (titleElem) {
          titleElem.textContent = isOutgoing ? `Sent file: ${fileName}` : `Received file: ${fileName}`;
        }
      }

      const parent = bar.closest('.p-2');
      if (parent && fileUrl) {
        if (fileType && fileType.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = fileUrl;
          img.className = 'img-fluid rounded mt-2';
          img.style.maxHeight = '250px';
          img.style.display = 'block';
          parent.appendChild(img);

          const a = document.createElement('a');
          a.href = fileUrl;
          a.download = fileName;
          a.className = 'btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1';
          a.innerHTML = '<i class="icon-base ti tabler-download fs-6"></i> Download Image';
          parent.appendChild(a);
        } else {
          const a = document.createElement('a');
          a.href = fileUrl;
          a.download = fileName;
          a.className = 'btn btn-sm btn-primary mt-2 d-inline-flex align-items-center gap-1';
          a.innerHTML = '<i class="icon-base ti tabler-download fs-6"></i> Download File';
          parent.appendChild(a);
        }
      }
    }
  }

  function renderSidebarUsers() {
    DOM.sidebarUserList.innerHTML = '';

    if (state.users.size === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'chat-contact-list-item text-center p-3 text-body-secondary';
      emptyLi.textContent = 'No other users online';
      DOM.sidebarUserList.appendChild(emptyLi);
      return;
    }

    state.users.forEach((user, socketId) => {
      const item = document.createElement('li');
      item.className = `chat-contact-list-item mb-1 ${state.activeChat.targetId === socketId ? 'active' : ''}`;
      
      const avatarSrc = user.avatar || generateDefaultAvatar(user.name || user.email);
      const unread = state.unreadCounts.get(socketId) || 0;

      item.innerHTML = `
        <div class="d-flex align-items-center w-100 overflow-hidden">
          <div class="flex-shrink-0 avatar avatar-online me-3" style="width:38px !important; height:38px !important; min-width:38px !important;">
            <img src="${avatarSrc}" alt="${user.name}" class="rounded-circle" style="width:38px !important; height:38px !important; object-fit:cover !important;">
          </div>
          <div class="chat-contact-info flex-grow-1 overflow-hidden">
            <h6 class="chat-contact-name text-truncate m-0 fw-semibold" style="font-size:0.875rem;">${user.name || 'User'}</h6>
            <small class="chat-contact-status text-truncate d-block text-body-secondary" style="font-size:0.75rem;">${user.email || socketId}</small>
          </div>
          ${unread > 0 ? `<span class="badge bg-danger rounded-pill ms-2">${unread}</span>` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        const userEmail = user.userId || user.email || socketId;
        selectChatTarget('user', socketId, user.name || user.email, avatarSrc, user.email, userEmail);
      });

      DOM.sidebarUserList.appendChild(item);
    });
  }

  function renderSidebarRooms() {
    DOM.sidebarRoomList.innerHTML = '';

    if (state.rooms.size === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'chat-contact-list-item text-center p-3 text-body-secondary';
      emptyLi.textContent = 'No rooms created';
      DOM.sidebarRoomList.appendChild(emptyLi);
      return;
    }

    state.rooms.forEach((room, roomName) => {
      const item = document.createElement('li');
      item.className = `chat-contact-list-item mb-1 ${state.activeChat.targetId === roomName ? 'active' : ''}`;

      const unread = state.unreadCounts.get(roomName) || 0;
      const userCount = room.users ? room.users.length : 1;

      item.innerHTML = `
        <div class="d-flex align-items-center w-100 overflow-hidden">
          <div class="flex-shrink-0 me-3 d-flex align-items-center justify-content-center bg-label-primary rounded-circle" style="width:38px !important; height:38px !important; min-width:38px !important; font-weight:bold;">#</div>
          <div class="chat-contact-info flex-grow-1 overflow-hidden">
            <h6 class="chat-contact-name text-truncate m-0 fw-semibold" style="font-size:0.875rem;"># ${roomName}</h6>
            <small class="chat-contact-status text-truncate d-block text-body-secondary" style="font-size:0.75rem;">${userCount} members</small>
          </div>
          ${unread > 0 ? `<span class="badge bg-danger rounded-pill ms-2">${unread}</span>` : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        state.socket.emit('joinRoom', {
          roomName: roomName,
          name: state.currentUser.name,
          email: state.currentUser.email
        });
        selectChatTarget('room', roomName, `# ${roomName}`, null, `${userCount} members`, null);
      });

      DOM.sidebarRoomList.appendChild(item);
    });
  }

  function selectChatTarget(type, targetId, title, avatar, subtitle, targetEmail) {
    state.activeChat.type = type;
    state.activeChat.targetId = targetId;
    state.activeChat.targetName = title;
    state.activeChat.targetEmail = targetEmail || (state.users.get(targetId) ? state.users.get(targetId).userId : targetId);

    state.unreadCounts.delete(targetId);

    DOM.chatHeaderTitle.textContent = title;
    DOM.chatHeaderSub.textContent = subtitle || (type === 'user' ? 'Active Now' : 'Room');
    if (avatar) {
      DOM.chatHeaderAvatar.src = avatar;
      if (DOM.chatHeaderAvatarWrap) DOM.chatHeaderAvatarWrap.style.display = 'block';
    } else {
      if (DOM.chatHeaderAvatarWrap) DOM.chatHeaderAvatarWrap.style.display = 'none';
    }

    DOM.messagesArea.innerHTML = '';
    const logs = state.chatLogs.get(targetId) || [];
    
    if (logs.length === 0) {
      DOM.emptyChatState.style.display = 'block';
    } else {
      DOM.emptyChatState.style.display = 'none';
      logs.forEach(msg => appendMessageToDOM(msg));
    }

    renderSidebarUsers();
    renderSidebarRooms();
  }

  DOM.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const name = DOM.nameInput.value.trim();
    const email = DOM.emailInput.value.trim();
    const finalAvatar = state.avatarBase64 || generateDefaultAvatar(name);

    state.currentUser.userId = email;
    state.currentUser.name = name;
    state.currentUser.email = email;
    state.currentUser.avatar = finalAvatar;

    DOM.myAvatar.src = finalAvatar;
    DOM.myName.textContent = name;
    DOM.myEmail.textContent = email;

    initSocketConnection();
  });

  DOM.chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = DOM.messageInput.value.trim();
    if (!text || !state.activeChat.targetId) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageObj = {
      id: Date.now(),
      senderId: state.currentUser.socketId,
      senderName: state.currentUser.name,
      senderAvatar: state.currentUser.avatar,
      text: text,
      timestamp: timeStr,
      isOutgoing: true
    };

    const targetKey = state.activeChat.targetId;
    if (!state.chatLogs.has(targetKey)) state.chatLogs.set(targetKey, []);
    state.chatLogs.get(targetKey).push(messageObj);

    appendMessageToDOM(messageObj);
    DOM.messageInput.value = '';

    if (state.activeChat.type === 'user') {
      state.socket.emit('sendMessage', {
        message: {
          receiverId: targetKey,
          senderId: state.currentUser.socketId,
          senderUserId: state.currentUser.email,
          senderName: state.currentUser.name,
          senderAvatar: state.currentUser.avatar,
          text: text,
          timestamp: timeStr
        }
      });
    } else if (state.activeChat.type === 'room') {
      state.socket.emit('sendMessage', {
        roomName: targetKey,
        message: {
          senderId: state.currentUser.socketId,
          senderUserId: state.currentUser.email,
          senderName: state.currentUser.name,
          senderAvatar: state.currentUser.avatar,
          text: text,
          timestamp: timeStr
        }
      });
    }
  });

  DOM.fileAttachBtn.addEventListener('click', () => DOM.fileInput.click());

  DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length === 0 || !state.activeChat.targetId) return;
    const file = e.target.files[0];

    const MAX_CHAT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB Limit
    if (file.size > MAX_CHAT_FILE_SIZE) {
      alert(`File size exceeds 5 MB limit. Selected file size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
      DOM.fileInput.value = '';
      return;
    }

    const uploadId = `upload_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messageObj = {
      id: uploadId,
      senderId: state.currentUser.socketId,
      senderName: state.currentUser.name,
      senderAvatar: state.currentUser.avatar,
      text: `Sending file: ${file.name}`,
      isFile: true,
      uploadId: uploadId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      timestamp: timeStr,
      isOutgoing: true
    };

    const targetKey = state.activeChat.targetId;
    if (!state.chatLogs.has(targetKey)) state.chatLogs.set(targetKey, []);
    state.chatLogs.get(targetKey).push(messageObj);
    appendMessageToDOM(messageObj);

    const targetEmail = state.activeChat.targetEmail || (state.users.get(targetKey) ? state.users.get(targetKey).userId : targetKey);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    state.activeUploads.set(uploadId, {
      file: file,
      chunkSize: CHUNK_SIZE,
      chunkIndex: 0,
      totalChunks: totalChunks,
      receiverId: targetEmail
    });

    state.socket.emit('fileStart', {
      uploadId: uploadId,
      senderId: state.currentUser.email,
      receiverId: targetEmail,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream'
    });

    DOM.fileInput.value = '';
  });

  DOM.tabUsersBtn.addEventListener('click', () => {
    DOM.tabUsersBtn.className = 'btn btn-sm btn-primary flex-fill';
    DOM.tabRoomsBtn.className = 'btn btn-sm btn-outline-secondary flex-fill';
    DOM.sidebarUserList.style.display = 'block';
    DOM.sidebarRoomList.style.display = 'none';
  });

  DOM.tabRoomsBtn.addEventListener('click', () => {
    DOM.tabRoomsBtn.className = 'btn btn-sm btn-primary flex-fill';
    DOM.tabUsersBtn.className = 'btn btn-sm btn-outline-secondary flex-fill';
    DOM.sidebarRoomList.style.display = 'block';
    DOM.sidebarUserList.style.display = 'none';
  });

  let roomModalInstance = null;

  DOM.createRoomBtn.addEventListener('click', () => {
    DOM.roomNameInput.value = '';
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      if (!roomModalInstance) {
        roomModalInstance = bootstrap.Modal.getOrCreateInstance(DOM.createRoomModal);
      }
      roomModalInstance.show();
    } else {
      DOM.createRoomModal.style.display = 'block';
      DOM.createRoomModal.classList.add('show');
    }
  });

  function closeModal() {
    if (roomModalInstance) {
      roomModalInstance.hide();
    }
    DOM.createRoomModal.style.display = 'none';
    DOM.createRoomModal.classList.remove('show');
    
    // Clean up any stray backdrop elements
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  DOM.cancelCreateRoomBtn.addEventListener('click', closeModal);
  DOM.closeRoomModalBtn.addEventListener('click', closeModal);

  DOM.confirmCreateRoomBtn.addEventListener('click', () => {
    const roomName = DOM.roomNameInput.value.trim();
    if (!roomName) return;

    if (state.socket) {
      state.socket.emit('createRoom', {
        roomName: roomName,
        name: state.currentUser.name,
        email: state.currentUser.email
      });
    }
    closeModal();
  });

  DOM.logoutBtn.addEventListener('click', () => {
    if (state.socket) {
      state.socket.emit('left');
      state.socket.disconnect();
    }
    showView('login');
  });

})();
