import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  QueryDocumentSnapshot,
  getDoc
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { useLoader } from '@/App';

export interface Room {
  id: string;
  homeId: string;
  name: string;
  icon: string;
  description: string;
  videos: string[];
  createdAt: any;
  updatedAt: any;
}

export interface VideoAnalysis {
  id: string;
  roomId: string;
  videoUrl: string;
  cloudinaryUrl?: string;
  items: string[];
  missingItems: string[];
  status: 'pending' | 'completed' | 'failed';
  completedAt?: any;
  createdAt: any;
}

export interface CreateRoomData {
  homeId: string;
  name: string;
  icon: string;
  description: string;
}

export interface Home {
  id: string;
  name: string;
  address: string;
  imageUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface CreateHomeData {
  name: string;
  address: string;
  imageUrl?: string;
}

// Helper to wrap API calls with loader
export async function withLoader<T>(fn: () => Promise<T>): Promise<T> {
  const loader = (typeof window !== 'undefined' && (window as any).loaderCtx) || { show: () => {}, hide: () => {} };
  try {
    loader.show();
    return await fn();
  } finally {
    loader.hide();
  }
}

// Test Firebase connection
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    // Try to get a single document to test connection
    const testQuery = query(collection(db, 'rooms'), where('homeId', '==', 'test'));
    await getDocs(testQuery);
    console.log('Firebase connection test successful');
    return true;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
};

// Room operations
export const createRoom = async (roomData: CreateRoomData): Promise<string> => {
  try {
    console.log('Creating room in Firebase with data:', roomData);
    
    const docRef = await addDoc(collection(db, 'rooms'), {
      ...roomData,
      videos: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log('Room created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating room in Firebase:', error);
    throw error;
  }
};

export const getRoomsByHomeId = async (homeId: string): Promise<Room[]> => {
  try {
    const q = query(
      collection(db, 'rooms'),
      where('homeId', '==', homeId)
    );
    
    const querySnapshot = await getDocs(q);
    const rooms: Room[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      // Filter out deleted rooms in the application
      if (!data.deletedAt) {
        rooms.push({
          id: doc.id,
          ...data
        } as Room);
      }
    });
    
    return rooms.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });
  } catch (error) {
    console.error('Error getting rooms:', error);
    throw error;
  }
};

export const updateRoomVideos = async (roomId: string, videoUrls: string[]): Promise<void> => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      videos: videoUrls,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating room videos:', error);
    throw error;
  }
};

// Video Analysis operations
export const createVideoAnalysis = async (
  roomId: string,
  videoUrl: string,
  cloudinaryUrl?: string
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'videoAnalyses'), {
      roomId,
      videoUrl,
      cloudinaryUrl,
      items: [],
      missingItems: [],
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating video analysis:', error);
    throw error;
  }
};

export const updateVideoAnalysisResults = async (
  analysisId: string,
  items: string[],
  missingItems: string[] = [],
  cloudinaryUrl?: string
): Promise<void> => {
  try {
    const analysisRef = doc(db, 'videoAnalyses', analysisId);
    await updateDoc(analysisRef, {
      items,
      missingItems,
      cloudinaryUrl,
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating video analysis results:', error);
    throw error;
  }
};

export const getVideoAnalysesByRoomId = async (roomId: string): Promise<VideoAnalysis[]> => {
  try {
    const q = query(
      collection(db, 'videoAnalyses'),
      where('roomId', '==', roomId)
    );
    
    const querySnapshot = await getDocs(q);
    const analyses: VideoAnalysis[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      // Filter out deleted analyses in the application
      if (!data.deletedAt) {
        analyses.push({
          id: doc.id,
          ...data
        } as VideoAnalysis);
      }
    });
    
    return analyses.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });
  } catch (error) {
    console.error('Error getting video analyses:', error);
    throw error;
  }
};

export const getCompletedAnalysesByRoomId = async (roomId: string): Promise<VideoAnalysis[]> => {
  try {
    const q = query(
      collection(db, 'videoAnalyses'),
      where('roomId', '==', roomId),
      where('status', '==', 'completed')
    );
    
    const querySnapshot = await getDocs(q);
    const analyses: VideoAnalysis[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      // Filter out deleted analyses in the application
      if (!data.deletedAt) {
        analyses.push({
          id: doc.id,
          ...data
        } as VideoAnalysis);
      }
    });
    
    return analyses.sort((a, b) => {
      const aTime = a.completedAt?.toDate?.() || new Date(0);
      const bTime = b.completedAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });
  } catch (error) {
    console.error('Error getting completed analyses:', error);
    throw error;
  }
};

// Batch Analysis operations
export const createBatchVideoAnalysis = async (
  roomId: string,
  batchEntry: { videoUrls: string[]; items: string[]; type: string; createdAt: Date }
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'batchAnalyses'), {
      roomId,
      videoUrls: batchEntry.videoUrls,
      items: batchEntry.items,
      type: batchEntry.type,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating batch video analysis:', error);
    throw error;
  }
};

export const getBatchAnalysesByRoomId = async (roomId: string): Promise<any[]> => {
  try {
    const q = query(
      collection(db, 'batchAnalyses'),
      where('roomId', '==', roomId)
    );
    const querySnapshot = await getDocs(q);
    const batches: any[] = [];
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      batches.push({ id: doc.id, ...doc.data() });
    });
    return batches;
  } catch (error) {
    console.error('Error getting batch analyses:', error);
    throw error;
  }
};

// Home operations
export const createHome = async (homeData: CreateHomeData): Promise<string> => {
  try {
    console.log('Creating home in Firebase with data:', homeData);
    
    const docRef = await addDoc(collection(db, 'homes'), {
      ...homeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    console.log('Home created successfully with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating home in Firebase:', error);
    throw error;
  }
};

export const getAllHomes = async (): Promise<Home[]> => {
  try {
    const q = query(
      collection(db, 'homes')
    );
    
    const querySnapshot = await getDocs(q);
    const homes: Home[] = [];
    
    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      // Filter out deleted homes in the application
      if (!data.deletedAt) {
        homes.push({
          id: doc.id,
          ...data
        } as Home);
      }
    });
    
    return homes.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return bTime.getTime() - aTime.getTime();
    });
  } catch (error) {
    console.error('Error getting homes:', error);
    throw error;
  }
};

export const getHomeById = async (homeId: string): Promise<Home | null> => {
  try {
    const homeRef = doc(db, 'homes', homeId);
    const homeDoc = await getDoc(homeRef);
    
    if (homeDoc.exists() && !homeDoc.data().deletedAt) {
      return {
        id: homeDoc.id,
        ...homeDoc.data()
      } as Home;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting home by ID:', error);
    throw error;
  }
};

export const updateHome = async (homeId: string, data: Partial<CreateHomeData>): Promise<void> => {
  try {
    const homeRef = doc(db, 'homes', homeId);
    await withLoader(() => updateDoc(homeRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }));
  } catch (error) {
    console.error('Error updating home:', error);
    throw error;
  }
};

export const deleteHome = async (homeId: string): Promise<void> => {
  try {
    console.log('Deleting home with ID:', homeId);
    
    // First, get all rooms in this home
    const rooms = await getRoomsByHomeId(homeId);
    console.log('Found rooms to delete:', rooms.length);
    
    // Delete all video analyses for rooms in this home
    for (const room of rooms) {
      const analyses = await getVideoAnalysesByRoomId(room.id);
      for (const analysis of analyses) {
        const analysisRef = doc(db, 'videoAnalyses', analysis.id);
        await updateDoc(analysisRef, { deletedAt: serverTimestamp() });
      }
    }
    
    // Delete all rooms in this home
    for (const room of rooms) {
      const roomRef = doc(db, 'rooms', room.id);
      await updateDoc(roomRef, { deletedAt: serverTimestamp() });
    }
    
    // Finally, delete the home
    const homeRef = doc(db, 'homes', homeId);
    await updateDoc(homeRef, { deletedAt: serverTimestamp() });
    
    console.log('Home and all associated data deleted successfully');
  } catch (error) {
    console.error('Error deleting home:', error);
    throw error;
  }
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  try {
    console.log('Deleting room with ID:', roomId);
    
    // Delete all video analyses for this room
    const analyses = await getVideoAnalysesByRoomId(roomId);
    for (const analysis of analyses) {
      const analysisRef = doc(db, 'videoAnalyses', analysis.id);
      await updateDoc(analysisRef, { deletedAt: serverTimestamp() });
    }
    
    // Delete the room
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { deletedAt: serverTimestamp() });
    
    console.log('Room and all associated data deleted successfully');
  } catch (error) {
    console.error('Error deleting room:', error);
    throw error;
  }
};

export const deleteVideoAnalysis = async (analysisId: string): Promise<void> => {
  try {
    const analysisRef = doc(db, 'videoAnalyses', analysisId);
    await updateDoc(analysisRef, { deletedAt: serverTimestamp() });
  } catch (error) {
    console.error('Error deleting video analysis:', error);
    throw error;
  }
}; 