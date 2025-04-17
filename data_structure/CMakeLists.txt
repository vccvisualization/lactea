
CMAKE_MINIMUM_REQUIRED(VERSION 3.7...3.23)
set(CMAKE_CXX_STANDARD 20)
PROJECT(lactea C CXX)
# set(CMAKE_CXX_FLAGS -pthread)
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O0")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O0")
############ Dependencies

find_package (Threads REQUIRED)
#find_package(Boost)
find_package(TBB CONFIG REQUIRED)

############## Default target to build

if(NOT CMAKE_BUILD_TYPE)
	set(CMAKE_BUILD_TYPE Release)
endif(NOT CMAKE_BUILD_TYPE)

############## Output to the "bin" and "lib" folders

set( CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/bin )
set( CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/lib )
foreach( OUTPUTCONFIG ${CMAKE_CONFIGURATION_TYPES} )
	string( TOUPPER ${OUTPUTCONFIG} OUTPUTCONFIG )
	set( CMAKE_RUNTIME_OUTPUT_DIRECTORY_${OUTPUTCONFIG} ${CMAKE_SOURCE_DIR}/bin )
	set( CMAKE_LIBRARY_OUTPUT_DIRECTORY_${OUTPUTCONFIG} ${CMAKE_SOURCE_DIR}/lib )
endforeach( OUTPUTCONFIG CMAKE_CONFIGURATION_TYPES )

############## Removing some warnings on Visual Studio

if(MSVC)
	add_compile_definitions(NOMINMAX)
	add_definitions(/D_CRT_SECURE_NO_WARNINGS)
	add_definitions(/D_SCL_SECURE_NO_WARNINGS)
	# For generating folders in IDE by same directory structure
	file(GLOB_RECURSE _source_list *.cpp* *.h* *.hpp*)
	foreach(_source IN ITEMS ${_source_list})
		get_filename_component(_source_path "${_source}" PATH)
		string(REPLACE "${CMAKE_SOURCE_DIR}/src/" "" _group_path "${_source_path}")
		string(REPLACE "/" "\\" _group_path "${_group_path}")
		source_group("${_group_path}" FILES "${_source}")
	endforeach()
endif()

######## Includes for everybody ############
include_directories( "${PROJECT_SOURCE_DIR}/src" )

######## Files ############
file(GLOB_RECURSE LACTEAXP_MERGE_SRC_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "src/lactea_xp_merged/*.cpp" "src/lactea_xp_merged/*.hpp" "src/lactea_xp_merged/*.c" "src/lactea_xp_merged/*.h")
file(GLOB_RECURSE UTILS_SRC_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "src/utils/*.cpp" "src/utils/*.hpp" "src/utils/*.c" "src/utils/*.h" "src/utils/gl/*.cpp" "src/utils/gl/*.hpp" "src/utils/gl/*.c" "src/utils/gl/*.h" "src/utils/ImGuiFileDialog/ImGuiFileDialog.cpp")
file(GLOB_RECURSE EXTERNAL_SORT_SRC_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" "src/external_sort/*.cpp" "src/external_sort/*.hpp")

##############################################################################


############# XP SAMPLED CONTINUOUS AND MERGED VERSIONS ###############

###### Libary LACTEA XP MERGED
add_library( lactea_xp_merged ${LACTEAXP_MERGE_SRC_FILES}
		src/utils/portable_io.h
		src/utils/portable_io.cpp
		)
target_link_libraries(lactea_xp_merged
		TBB::tbb
		Threads::Threads
		)

#### Star sorter XP MERGED
add_executable( lactea_raw_star_db_sorter_xp_merged
		${EXTERNAL_SORT_SRC_FILES}
		src/raw_star_db_sorter_xp_merged/raw_star_db_sorter_xp_merged.cpp
		)
target_link_libraries(lactea_raw_star_db_sorter_xp_merged lactea_xp_merged)


#### Star subset writer sorter XP MERGED
add_executable( lactea_raw_star_db_subset_writer_xp_merged
		src/raw_star_db_subset_writer_xp_merged/raw_star_db_subset_writer_xp_merged.cpp
		)
target_link_libraries(lactea_raw_star_db_subset_writer_xp_merged lactea_xp_merged)

#### Builder XP MERGED
add_executable( lactea_star_tree_builder_xp_merged
		src/star_tree_builder_xp_merged/star_tree_builder_xp_merged.cpp
		)
target_link_libraries(lactea_star_tree_builder_xp_merged lactea_xp_merged)

#### Chunker MERGED
add_executable( lactea_star_tree_chunker_xp_merged
		src/star_tree_chunker_xp_merged/star_tree_chunker_xp_merged.cpp
		)
target_link_libraries(lactea_star_tree_chunker_xp_merged lactea_xp_merged)


#### Sandbox for test
add_executable( lactea_sandbox
		src/sandbox/sandbox.cpp
		)
target_link_libraries(lactea_sandbox lactea_xp_merged)

