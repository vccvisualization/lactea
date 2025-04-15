#include "portable_io.h"


int64_t portable_ftell64(FILE *a)
{
#ifdef __CYGWIN__
    return ftell64(a);
#elif defined (_WIN32)
    return _ftelli64(a);
#else
    return ftello64(a);
#endif
}

int64_t portable_fseek64(FILE *stream, long offset, int whence)
{
#ifdef __CYGWIN__
    return fseek64(a);
#elif defined (_WIN32)
    return _fseeki64(stream, offset, whence);
#else
    return fseeko64(stream, offset, whence);
#endif
}
