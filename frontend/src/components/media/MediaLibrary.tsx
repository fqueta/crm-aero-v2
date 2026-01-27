import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadsService } from '@/services/uploadsService';
import { UploadRecord } from '@/types/uploads';
import { PaginatedResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, Upload, FileText, File as FileIcon, Film, Check, Trash2, X, Image as ImageIcon, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FALLBACK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface MediaLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (items: UploadRecord[]) => void;
  multiSelect?: boolean;
  selectedIds?: number[]; // IDs already selected
  acceptedTypes?: string[]; // e.g. ['image/*', 'application/pdf']
}

interface MediaItemProps {
  item: UploadRecord;
  selected: boolean;
  onSelect: (item: UploadRecord) => void;
}

const getFileIcon = (mime: string) => {
  if (mime.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-purple-500" />;
  if (mime.startsWith('video/')) return <Film className="h-8 w-8 text-red-500" />;
  if (mime.startsWith('audio/')) return <Music className="h-8 w-8 text-yellow-500" />;
  if (mime === 'application/pdf') return <FileText className="h-8 w-8 text-red-600" />;
  if (mime.includes('word') || mime.includes('document')) return <FileText className="h-8 w-8 text-blue-600" />;
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText className="h-8 w-8 text-green-600" />;
  return <FileIcon className="h-8 w-8 text-gray-400" />;
};

const MediaItem = ({ item, selected, onSelect }: MediaItemProps) => {
  const isImage = item.mime.startsWith('image/');

  return (
    <div
      className={cn(
        "group relative aspect-square rounded-xl border-2 cursor-pointer transition-all duration-200 overflow-hidden bg-white hover:shadow-md",
        selected ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent hover:border-gray-200"
      )}
      onClick={() => onSelect(item)}
    >
      {isImage ? (
        <img
          src={item.url}
          alt={item.nome}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = FALLBACK_IMG;
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-4">
          {getFileIcon(item.mime)}
          <span className="text-xs text-gray-500 mt-2 text-center line-clamp-2 px-2">
            {item.mime.split('/')[1]?.toUpperCase() || 'FILE'}
          </span>
        </div>
      )}
      
      {/* Overlay with Info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
        <p className="text-white text-xs font-medium truncate">{item.nome}</p>
        <p className="text-white/70 text-[10px]">{formatBytes(item.size)}</p>
      </div>

      {selected && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
          <Check className="h-3 w-3" />
        </div>
      )}
    </div>
  );
};

const formatBytes = (bytes: number, decimals = 0) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export function MediaLibrary({
  open,
  onOpenChange,
  onSelect,
  multiSelect = false,
  selectedIds = [],
  acceptedTypes
}: MediaLibraryProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<UploadRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<UploadRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentSelection([]);
       // Ideally we would fetch the full objects for selectedIds if we wanted to show them as pre-selected in a separate "Selected" tab
       // For now, we just rely on matching IDs with the loaded items.
    }
  }, [open, selectedIds]);

  const fetchItems = async (pageNum: number, searchQuery: string) => {
    const params: any = { page: pageNum, per_page: 40, q: searchQuery, nome: searchQuery };
    const resp = await uploadsService.listUploads(params);
    return resp;
  };

  // Initial load
  const { data: initialData, isLoading: isInitialLoading, refetch } = useQuery<PaginatedResponse<UploadRecord>>({
    queryKey: ['uploads', 'library', { page: 1, q: search }],
    queryFn: () => fetchItems(1, search),
    enabled: open,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (initialData) {
      if (page === 1) {
        setItems(initialData.data);
      } else {
        // Appending handled by loadMore
      }
      setHasMore(initialData.current_page < initialData.last_page);
    }
  }, [initialData, page]); // Only reset on initial data change for page 1

  // Handle Search
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    // useQuery will auto-refetch due to key change
  };

  // Load More
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const resp = await fetchItems(nextPage, search);
      setItems(prev => [...prev, ...resp.data]);
      setPage(nextPage);
      setHasMore(resp.current_page < resp.last_page);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreateUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const arr = Array.from(files);
      const newUploads: UploadRecord[] = [];
      
      for (const file of arr) {
        // Simple client-side validation if needed
        const resp = await uploadsService.uploadFile(file);
        newUploads.push(resp.data);
      }
      
      toast({
        title: "Upload concluído",
        description: `${newUploads.length} arquivo(s) enviado(s) com sucesso.`,
      });

      // Add to beginning of list
      setItems(prev => [...newUploads, ...prev]);
      
      // Auto-select uploaded items
      if (newUploads.length > 0) {
        if (multiSelect) {
          setCurrentSelection(prev => [...prev, ...newUploads]);
        } else {
            // Only select the last one if single select
          setCurrentSelection([newUploads[newUploads.length - 1]]);
        }
      }

      // Invalidate query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['uploads'] });

    } catch (err) {
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar arquivo(s).",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelect = (item: UploadRecord) => {
    if (multiSelect) {
        setCurrentSelection(prev => {
            const exists = prev.find(p => p.id === item.id);
            if (exists) return prev.filter(p => p.id !== item.id);
            return [...prev, item];
        });
    } else {
        setCurrentSelection([item]);
    }
  };

  const isSelected = (id: number) => {
    return currentSelection.some(p => p.id === id) || selectedIds.includes(id);
  };

  const confirmSelection = () => {
    onSelect(currentSelection);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-gray-50/50">
        <div className="p-6 border-b bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
              Biblioteca de Mídia
            </DialogTitle>
            <DialogDescription>
              Gerencie seus arquivos. Selecione itens para adicionar ao seu projeto.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Buscar arquivos..." 
                className="pl-9 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    id="media-upload-input"
                    className="hidden"
                    multiple
                    onChange={(e) => handleCreateUpload(e.target.files)}
                />
                <Button onClick={() => document.getElementById('media-upload-input')?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload
                </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
            {isInitialLoading && page === 1 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Carregando biblioteca...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                    <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center">
                        <FileIcon className="h-10 w-10 text-gray-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">Nenhum arquivo encontrado</h3>
                        <p className="text-sm text-gray-500 max-w-sm mt-1">
                            Não encontramos arquivos com os termos buscados. Tente fazer um upload.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => document.getElementById('media-upload-input')?.click()}>
                        Fazer Upload agora
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {items.map(item => (
                        <MediaItem 
                            key={item.id} 
                            item={item} 
                            selected={isSelected(item.id)} // Note: selectedIds check might need refinement if we want to toggle them off
                            onSelect={toggleSelect}
                        />
                    ))}
                </div>
            )}
            
            {hasMore && !isInitialLoading && (
                <div className="flex justify-center mt-8 pb-4">
                    <Button variant="ghost" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Carregar mais
                    </Button>
                </div>
            )}
        </ScrollArea>

        <div className="p-4 border-t bg-white flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
                {currentSelection.length} item(s) selecionado(s)
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={confirmSelection} disabled={currentSelection.length === 0}>
                    Inserir Selecionados
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
