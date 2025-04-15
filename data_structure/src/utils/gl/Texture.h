#pragma once

#include "glIncludes.h"


template <GLuint T, typename S>
class Texture {
private:
    GLuint id = 0;
    GLint i_format;
    GLint format;
    GLint data_type;
    S size;
public:
    Texture(void *data, S size, GLint i_format = GL_RGBA, GLenum data_type = GL_FLOAT, GLenum format = GL_RGBA) :
            i_format(i_format), data_type(data_type), format(format), size(size) {
        glGenTextures(1, &id);

        glBindTexture(T, id);
        if constexpr (T == GL_TEXTURE_1D) glTexImage1D(T, 0, i_format, size, 0, format, data_type, data);
        if constexpr (T == GL_TEXTURE_2D) glTexImage2D(T, 0, i_format, size.x, size.y, 0, format, data_type, data);
        if constexpr (T == GL_TEXTURE_3D) glTexImage3D(T, 0, i_format, size.x, size.y, size.z, 0, format, data_type, data);

        glTexParameteri(T, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        if constexpr (T != GL_TEXTURE_1D) glTexParameteri(T, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        if constexpr (T == GL_TEXTURE_3D) glTexParameteri(T, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);

        glTexParameteri(T, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(T, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    }
    virtual ~Texture() {
        if(id != 0)	glDeleteTextures(1, &id);
    }
    void bind(int slot) {
        glActiveTexture(GL_TEXTURE0 + slot);
        glBindTexture(T, id);
    }
    void bindImage(int slot) {
        glBindImageTexture(slot, id, 0, GL_FALSE, 0, GL_READ_WRITE, i_format);
    }
    void resize(S size) {
        if(size != this->size){
            this->size = size;
            glBindTexture(T, id);
            if constexpr (T == GL_TEXTURE_1D) glTexImage1D(T, 0, i_format, size, 0, format, data_type, NULL);
            if constexpr (T == GL_TEXTURE_2D) glTexImage2D(T, 0, i_format, size.x, size.y, 0, format, data_type, NULL);
            if constexpr (T == GL_TEXTURE_3D) glTexImage3D(T, 0, i_format, size.x, size.y, size.z, 0, format, data_type, NULL);

        }
    }
    void update(void *data, S size) {
        glBindTexture(T, id);
        if(size != this->size){
            this->size = size;
            if constexpr (T == GL_TEXTURE_1D) glTexImage1D(T, 0, i_format, size, 0, format, data_type, data);
            if constexpr (T == GL_TEXTURE_2D) glTexImage2D(T, 0, i_format, size.x, size.y, 0, format, data_type, data);
            if constexpr (T == GL_TEXTURE_3D) glTexImage3D(T, 0, i_format, size.x, size.y, size.z, 0, format, data_type, data);

        }else{
            if constexpr (T == GL_TEXTURE_1D) glTexSubImage1D(T, 0, 0, size, format, data_type, data);
            if constexpr (T == GL_TEXTURE_2D) glTexSubImage2D(T, 0, 0, 0, size.x, size.y, format, data_type, data);
            if constexpr (T == GL_TEXTURE_3D) glTexSubImage3D(T, 0, 0, 0, 0, size.x, size.y, size.z, format, data_type, data);

        }
    }
    void clear() {
        glBindTexture(T, id);
        GLuint clearColor[4] = {0};
        glClearTexImage(id, 0, GL_BGRA, GL_UNSIGNED_BYTE, &clearColor);
//        glClearTexImage(id, 0, format, data_type, &clearColor);
    }

    inline GLuint& getId() { return id; }
    S getSize(){ return size; };
};
