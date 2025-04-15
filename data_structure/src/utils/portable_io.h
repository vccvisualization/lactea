#pragma once

#ifndef LACTEA_PORTABLE_IO_H
#define LACTEA_PORTABLE_IO_H
#include <stdint.h>
#include <stdio.h>

#if defined (_WIN32)
    #define PATH_SEP "\\"
#else
    #define PATH_SEP "/"
#endif

int64_t portable_ftell64(FILE *a);

int64_t portable_fseek64(FILE *stream, long offset, int whence);

#endif //LACTEA_PORTABLE_IO_H
