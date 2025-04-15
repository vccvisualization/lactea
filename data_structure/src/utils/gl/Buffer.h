#pragma once

#include "glIncludes.h"


template <GLuint buffer_type>
class Buffer {
private:
    GLuint buffer = 0;
    size_t element_size;
    size_t element_count;
public:
    Buffer(void *data, size_t element_count, size_t element_size) : element_count(element_count), element_size(element_size) {
        glGenBuffers(1, &buffer);
        glBindBuffer(buffer_type, buffer);
        if (element_count != 0)
            glBufferData(buffer_type, element_count * element_size, data, GL_STATIC_DRAW);

        this->unbind();
    }

    ~Buffer() {
        if(buffer != 0) glDeleteBuffers(1, &buffer);
    }

    void update(void *data, size_t element_count) {
        this->element_count = element_count;
        glBindBuffer(buffer_type, buffer);
        glBufferData(buffer_type, element_count * element_size, data, GL_STATIC_DRAW);
    }

    void bind() {
        glBindBuffer(buffer_type, buffer);
    }

    void unbind() {
        glBindBuffer(buffer_type, 0);
    }

    void bind(unsigned int slot) {
        if constexpr (buffer_type == GL_UNIFORM_BUFFER) glBindBufferBase(GL_UNIFORM_BUFFER, slot, buffer);
        else glBindBufferBase(GL_SHADER_STORAGE_BUFFER, slot, buffer);
    }
    inline GLuint& getBuffer() { return buffer; }
    inline size_t getElementSize() const { return element_size; }
    inline size_t getElementCount() const { return element_count; }
};
