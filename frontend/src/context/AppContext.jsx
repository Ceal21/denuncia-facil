import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { INITIAL_CHATS, INITIAL_MESSAGES, INITIAL_FOUND_ITEMS, MOCK_USERS, createEmptyDraft } from '../data/mockData';
import { generateAIResponse, extractDataFromMessage, determineConversationStage, generateNextStepsMessage } from '../utils/aiEngine';
import { generateId, normalizeText, matchesFoundItem, buildFoundItemMessage } from '../utils/helpers';

const ACTIVE_STATUSES = new Set(['draft', 'pending_confirmation', 'pending', 'in_review']);

const AppContext = createContext(null);

const initialState = {
  currentUser: null,
  chats: { ...INITIAL_CHATS },
  messages: { ...INITIAL_MESSAGES },
  foundItems: [...INITIAL_FOUND_ITEMS],
  selectedChatId: null,
  typingChats: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, currentUser: action.user };

    case 'LOGOUT':
      return { ...initialState, chats: { ...INITIAL_CHATS }, messages: { ...INITIAL_MESSAGES }, foundItems: [...INITIAL_FOUND_ITEMS] };

    case 'SELECT_CHAT': {
      const chat = state.chats[action.chatId];
      if (!chat) return { ...state, selectedChatId: action.chatId };
      const userType = state.currentUser?.userType;
      return {
        ...state,
        selectedChatId: action.chatId,
        chats: {
          ...state.chats,
          [action.chatId]: {
            ...chat,
            unreadCount: { ...chat.unreadCount, [userType]: 0 },
          },
        },
      };
    }

    case 'ADD_MESSAGE': {
      const { chatId, message } = action;
      const existing = state.messages[chatId] || [];
      return {
        ...state,
        messages: { ...state.messages, [chatId]: [...existing, message] },
        chats: {
          ...state.chats,
          [chatId]: {
            ...state.chats[chatId],
            lastMessagePreview: message.content.substring(0, 80).replace(/\*\*/g, ''),
            updatedAt: message.timestamp,
          },
        },
      };
    }

    case 'UPDATE_CHAT': {
      const { chatId, updates } = action;
      return {
        ...state,
        chats: { ...state.chats, [chatId]: { ...state.chats[chatId], ...updates } },
      };
    }

    case 'SET_TYPING': {
      const { chatId, isTyping } = action;
      return {
        ...state,
        typingChats: isTyping
          ? [...state.typingChats.filter((id) => id !== chatId), chatId]
          : state.typingChats.filter((id) => id !== chatId),
      };
    }

    case 'CREATE_NEW_CHAT': {
      const { chat, message } = action;
      return {
        ...state,
        chats: { ...state.chats, [chat.chatId]: chat },
        messages: { ...state.messages, [chat.chatId]: [message] },
        selectedChatId: chat.chatId,
      };
    }

    case 'CLAIM_CHAT': {
      const { chatId, officer } = action;
      const claimMsg = {
        id: generateId('SYS'),
        senderId: 'AI',
        senderType: 'ai',
        content: `Tu denuncia fue recibida por ${officer.name}. Estado: En revisión.`,
        timestamp: new Date().toISOString(),
        messageType: 'status_update',
        metadata: { newStatus: 'in_review', previousStatus: 'pending', actorName: officer.name },
      };
      return {
        ...state,
        chats: {
          ...state.chats,
          [chatId]: {
            ...state.chats[chatId],
            status: 'in_review',
            officerId: officer.id,
            officerName: officer.name,
            updatedAt: new Date().toISOString(),
          },
        },
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), claimMsg],
        },
      };
    }

    case 'REGISTER_FOUND_ITEM':
      return { ...state, foundItems: [...state.foundItems, action.item] };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const login = useCallback((role) => {
    dispatch({ type: 'LOGIN', user: MOCK_USERS[role] });
  }, []);

  const loginCitizen = useCallback((formData) => {
    const { dni, apellido_paterno, apellido_materno, nombres, telefono, email } = formData;

    // Return seeded user so demo chats are visible
    if (dni === MOCK_USERS.citizen.dni) {
      dispatch({ type: 'LOGIN', user: MOCK_USERS.citizen });
      return;
    }

    const fullName = [nombres, apellido_paterno, apellido_materno].filter(Boolean).join(' ');
    dispatch({
      type: 'LOGIN',
      user: {
        id: `USR-${dni}`,
        name: `${nombres} ${apellido_paterno}`.trim(),
        fullName,
        userType: 'citizen',
        dni,
        apellido_paterno,
        apellido_materno: apellido_materno || null,
        nombres,
        phone: telefono || null,
        email: email || null,
      },
    });
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  const selectChat = useCallback((chatId) => {
    dispatch({ type: 'SELECT_CHAT', chatId });
  }, []);

  const sendMessage = useCallback(
    async (chatId, content) => {
      const chat = state.chats[chatId];
      if (!chat || !state.currentUser) return;

      const now = new Date().toISOString();
      const citizenMsg = {
        id: generateId('MSG'),
        senderId: state.currentUser.id,
        senderType: 'citizen',
        content,
        timestamp: now,
        messageType: 'text',
      };
      dispatch({ type: 'ADD_MESSAGE', chatId, message: citizenMsg });

      const norm = normalizeText(content);

      if (chat.status === 'pending_confirmation' && (norm === 'si' || norm === 'sí')) {
        const confirmMsg = {
          id: generateId('SYS'),
          senderId: 'AI',
          senderType: 'ai',
          content: `Denuncia enviada exitosamente. Tu número de caso es #${chatId}. Un oficial de turno revisará tu denuncia a la brevedad.`,
          timestamp: new Date().toISOString(),
          messageType: 'status_update',
          metadata: { newStatus: 'pending', previousStatus: 'pending_confirmation' },
        };
        dispatch({ type: 'ADD_MESSAGE', chatId, message: confirmMsg });
        dispatch({ type: 'UPDATE_CHAT', chatId, updates: { status: 'pending', updatedAt: new Date().toISOString() } });

        dispatch({ type: 'SET_TYPING', chatId, isTyping: true });
        setTimeout(() => {
          dispatch({ type: 'SET_TYPING', chatId, isTyping: false });
          dispatch({
            type: 'ADD_MESSAGE',
            chatId,
            message: {
              id: generateId('AI'),
              senderId: 'AI',
              senderType: 'ai',
              content: generateNextStepsMessage(chat.draft_state),
              timestamp: new Date().toISOString(),
              messageType: 'ai_response',
            },
          });
        }, 1400);

        return;
      }

      if (chat.status !== 'draft' && chat.status !== 'pending_confirmation') return;

      dispatch({ type: 'SET_TYPING', chatId, isTyping: true });

      const currentDraft = chat.draft_state;
      const stage = determineConversationStage(currentDraft);
      const newDraft = extractDataFromMessage(content, stage, currentDraft);

      if (JSON.stringify(newDraft) !== JSON.stringify(currentDraft)) {
        dispatch({ type: 'UPDATE_CHAT', chatId, updates: { draft_state: newDraft } });
      }

      const delay = 850 + Math.random() * 650;

      setTimeout(() => {
        dispatch({ type: 'SET_TYPING', chatId, isTyping: false });

        const aiResponse = generateAIResponse(chatId, content, newDraft);
        const aiMsg = {
          id: generateId('AI'),
          senderId: 'AI',
          senderType: 'ai',
          content: aiResponse.text,
          timestamp: new Date().toISOString(),
          messageType: 'ai_response',
        };
        dispatch({ type: 'ADD_MESSAGE', chatId, message: aiMsg });

        if (aiResponse.readyForConfirmation && chat.status === 'draft') {
          dispatch({
            type: 'UPDATE_CHAT',
            chatId,
            updates: { status: 'pending_confirmation', updatedAt: new Date().toISOString() },
          });
        }
      }, delay);
    },
    [state.chats, state.currentUser]
  );

  const createNewChat = useCallback(() => {
    const existingIds = Object.keys(state.chats);
    const nextNum = String(existingIds.length + 1).padStart(3, '0');
    const chatId = `CHAT${nextNum}`;
    const now = new Date().toISOString();
    const user = state.currentUser;

    const draft = createEmptyDraft();
    draft.datos_generales.dni = user.dni || null;
    draft.datos_generales.apellido_paterno = user.apellido_paterno || null;
    draft.datos_generales.apellido_materno = user.apellido_materno || null;
    draft.datos_generales.nombres = user.nombres || null;
    draft.datos_generales.telefono_celular = user.phone || null;
    draft.datos_generales.correo = user.email || null;

    const nombre = user.nombres || user.name;

    const newChat = {
      chatId,
      status: 'draft',
      citizenId: user.id,
      citizenName: user.fullName || user.name,
      officerId: null,
      officerName: null,
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: '',
      unreadCount: { citizen: 0, officer: 0 },
      draft_state: draft,
      contenido_formal: null,
      resumen_oficial: null,
    };

    const welcomeMsg = {
      id: generateId('AI'),
      senderId: 'AI',
      senderType: 'ai',
      content: `¡Hola, **${nombre}**! Soy el asistente virtual de la Denuncia Fácil. Voy a ayudarte a registrar tu denuncia.\n\nTus datos personales ya están registrados. Para empezar: ¿en qué distrito de Lima o Callao ocurrió el hurto o robo? ¿Recuerdas una dirección o zona aproximada?`,
      timestamp: now,
      messageType: 'ai_response',
    };

    dispatch({ type: 'CREATE_NEW_CHAT', chat: newChat, message: welcomeMsg });
  }, [state.chats, state.currentUser]);

  const claimChat = useCallback(
    (chatId) => {
      if (!state.currentUser || state.currentUser.userType !== 'officer') return;
      dispatch({ type: 'CLAIM_CHAT', chatId, officer: state.currentUser });
    },
    [state.currentUser]
  );

  const updateChatStatus = useCallback(
    (chatId, newStatus) => {
      const prevStatus = state.chats[chatId]?.status;
      const now = new Date().toISOString();
      const name = state.currentUser?.name || 'el oficial';

      dispatch({ type: 'UPDATE_CHAT', chatId, updates: { status: newStatus, updatedAt: now } });

      if (newStatus === 'fiscalia') {
        const year = new Date().getFullYear();
        const code = `OF-${year}-${String(Math.floor(10000 + Math.random() * 90000))}`;
        const oficioMsg = {
          id: generateId('SYS'),
          senderId: 'AI',
          senderType: 'ai',
          content: `Oficio enviado a la Fiscalía, código: ${code}`,
          timestamp: now,
          messageType: 'status_update',
          metadata: { newStatus: 'fiscalia', previousStatus: prevStatus, actorName: name },
        };
        dispatch({ type: 'ADD_MESSAGE', chatId, message: oficioMsg });
      } else {
        const statusContent = newStatus === 'submitted'
          ? `Tu denuncia fue marcada como procesada por ${name}.`
          : newStatus === 'closed'
          ? `Tu denuncia fue cerrada por ${name}.`
          : null;
        if (!statusContent) return;
        const statusMsg = {
          id: generateId('SYS'),
          senderId: 'AI',
          senderType: 'ai',
          content: statusContent,
          timestamp: now,
          messageType: 'status_update',
          metadata: { newStatus, previousStatus: prevStatus, actorName: name },
        };
        dispatch({ type: 'ADD_MESSAGE', chatId, message: statusMsg });
      }
    },
    [state.currentUser, state.chats]
  );

  const closeWithReason = useCallback(
    (chatId, reason) => {
      const prevStatus = state.chats[chatId]?.status;
      const now = new Date().toISOString();

      const officerMsg = {
        id: generateId('MSG'),
        senderId: state.currentUser.id,
        senderName: state.currentUser.name,
        senderType: 'officer',
        content: reason,
        timestamp: now,
        messageType: 'text',
      };

      const statusMsg = {
        id: generateId('SYS'),
        senderId: 'AI',
        senderType: 'ai',
        content: `Tu denuncia fue cerrada por ${state.currentUser?.name || 'el oficial'}.`,
        timestamp: now,
        messageType: 'status_update',
        metadata: { newStatus: 'closed', previousStatus: prevStatus, actorName: state.currentUser?.name },
      };

      dispatch({ type: 'ADD_MESSAGE', chatId, message: officerMsg });
      dispatch({ type: 'UPDATE_CHAT', chatId, updates: { status: 'closed', updatedAt: now } });
      dispatch({ type: 'ADD_MESSAGE', chatId, message: statusMsg });
    },
    [state.currentUser, state.chats]
  );

  const registerFoundItem = useCallback(
    (itemData) => {
      const now = new Date().toISOString();
      const officer = state.currentUser;

      const matchedChatIds = Object.values(state.chats)
        .filter((chat) => {
          if (!ACTIVE_STATUSES.has(chat.status)) return false;
          const especies = chat.draft_state?.denuncia?.especies;
          return especies && especies.length > 0 && matchesFoundItem(especies, itemData.tipo);
        })
        .map((chat) => chat.chatId);

      const newItem = {
        id: generateId('FND'),
        tipo: itemData.tipo,
        descripcion: itemData.descripcion,
        comisaria_nombre: officer.officeName,
        comisaria_distrito: officer.officeDistrict,
        comisaria_direccion: officer.officeAddress || null,
        registrado_por: officer.id,
        registrado_por_nombre: officer.name,
        registradoAt: now,
        matched_chats: matchedChatIds,
      };

      dispatch({ type: 'REGISTER_FOUND_ITEM', item: newItem });

      const msgContent = buildFoundItemMessage(itemData.tipo, itemData.descripcion, officer);
      matchedChatIds.forEach((chatId) => {
        dispatch({
          type: 'ADD_MESSAGE',
          chatId,
          message: {
            id: generateId('AI'),
            senderId: 'AI',
            senderType: 'ai',
            content: msgContent,
            timestamp: now,
            messageType: 'ai_response',
          },
        });
      });

      return matchedChatIds.length;
    },
    [state.currentUser, state.chats]
  );

  const value = {
    ...state,
    login,
    loginCitizen,
    logout,
    selectChat,
    sendMessage,
    createNewChat,
    claimChat,
    updateChatStatus,
    closeWithReason,
    registerFoundItem,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
