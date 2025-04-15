#pragma once

#include "glIncludes.h"
#include "Texture.h"
#include "utils/lodepng.h"
#include <algorithm>


template <GLuint T, typename S>
class Framebuffer {
private:
    glm::ivec2 size;
    Texture<T, S> tex;
    GLuint id;
public:
    Framebuffer(S size, GLint i_format, GLenum data_type = GL_FLOAT, GLenum format = GL_RGBA) : tex(NULL, size, i_format, data_type, format) {
        if constexpr (T == GL_TEXTURE_1D) this->size = glm::ivec2(size, 1);
        else this->size = glm::ivec2(size.x, size.y);
        glGenFramebuffers(1, &id);
        glBindFramebuffer(GL_FRAMEBUFFER, id);
        if constexpr (T == GL_TEXTURE_1D) glFramebufferTexture1D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_1D, tex.getId(), 0);
        if constexpr (T == GL_TEXTURE_2D) glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex.getId(), 0);
        if constexpr (T == GL_TEXTURE_3D) glFramebufferTexture3D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_3D, tex.getId(), 0, 0);

    }
    virtual ~Framebuffer() {
        if(id != 0){
            glDeleteFramebuffers(1, &id);
        }
    }

    void resize(glm::ivec2 size) {
        this->size = size;
        if(tex.getId() != 0){
            if constexpr (T == GL_TEXTURE_1D) tex.resize(size);
            if constexpr (T == GL_TEXTURE_2D) tex.resize(size);
            if constexpr (T == GL_TEXTURE_3D) tex.resize(glm::ivec3(size, tex.getSize().z));
        }
    }

    void bind() {
        glBindFramebuffer(GL_FRAMEBUFFER, id);
        glViewport(0, 0, size.x, size.y);
    }

    static void bind_default(glm::ivec2 size) {
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glViewport(0, 0, size.x, size.y);
    }

    inline GLuint& getId() { return id; }
    glm::ivec2 getSize() const { return size; }
    Texture<T, S>& getTex() { return tex; }

    void save_image(std::string &outPath) {
        auto imageData = std::vector<unsigned char>(size.x * size.y * 4);
        bind();
        glReadPixels(0, 0, size.x, size.y, GL_RGBA, GL_UNSIGNED_BYTE, &imageData[0]);
        for(int line = 0; line != size.y/2; ++line) {
            std::swap_ranges(imageData.begin() + 4 * size.x * line,
                             imageData.begin() + 4 * size.x * (line+1),
                             imageData.begin() + 4 * size.x * (size.y-line-1)

            );
        }

        int error = lodepng::encode(outPath, imageData, size.x, size.y, LodePNGColorType::LCT_RGBA, 8);
        printf("imageWidth: %i, imageHeight: %i, imageData size: %zi\n", size.x, size.y, imageData.size());
        printf("lodepng error: %s\n", lodepng_error_text(error));
    }
};
