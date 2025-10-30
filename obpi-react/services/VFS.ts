/**
 * REFACTOR: VFS is no longer a stateful service.
 * Its only remaining role is to provide a client-side utility for path resolution.
 * All file system state and operations are now managed by the backend via the ApiService.
 */
export class VFS {
  public static resolvePath(path: string, cwd: string = '/'): string {
      if (path.startsWith('~')) {
          // Assuming home is just '/' in the context of the user's sandbox
          path = path.substring(1); 
      }

      if (path.startsWith('/')) {
        const normalized = path.replace(/\/+$/, '');
        return normalized === '' ? '/' : normalized;
      }
      
      const combined = `${cwd === '/' ? '' : cwd}/${path}`;
      const parts = combined.split('/').filter(Boolean);
      const resolvedParts: string[] = [];
      
      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
          resolvedParts.pop();
        } else {
          resolvedParts.push(part);
        }
      }
      
      const finalPath = `/${resolvedParts.join('/')}`;
      return finalPath;
  }
}
