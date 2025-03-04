import pygame
from pygame.locals import *

# Constants
GRID_WIDTH = 10
GRID_HEIGHT = 10
CELL_SIZE = 50
WINDOW_WIDTH = GRID_WIDTH * CELL_SIZE
WINDOW_HEIGHT = GRID_HEIGHT * CELL_SIZE + 100  # Extra for UI

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (200, 200, 200)
DARK_GRAY = (100, 100, 100)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)

# Directions
DIRECTIONS = {
    'up': (0, -1),
    'down': (0, 1),
    'left': (-1, 0),
    'right': (1, 0)
}

# Item types
ITEM_TYPES = ['mirror_slash', 'mirror_backslash', 'prism', 'filter_red', 'filter_green', 'filter_blue']

# Color mapping
COLOR_MAP = {
    'white': WHITE,
    'red': RED,
    'green': GREEN,
    'blue': BLUE
}

# Functions
def reflect(direction, mirror_type):
    """Reflect the beam based on mirror orientation."""
    if mirror_type == '/':
        if direction == 'right': return 'up'
        elif direction == 'down': return 'left'
        elif direction == 'left': return 'down'
        elif direction == 'up': return 'right'
    elif mirror_type == '\\':
        if direction == 'right': return 'down'
        elif direction == 'up': return 'left'
        elif direction == 'left': return 'up'
        elif direction == 'down': return 'right'
    return direction

def turn_left(direction):
    """Rotate direction 90 degrees left."""
    if direction == 'up': return 'left'
    elif direction == 'left': return 'down'
    elif direction == 'down': return 'right'
    elif direction == 'right': return 'up'

def turn_right(direction):
    """Rotate direction 90 degrees right."""
    if direction == 'up': return 'right'
    elif direction == 'right': return 'down'
    elif direction == 'down': return 'left'
    elif direction == 'left': return 'up'

def trace_beam(fixed_grid, player_grid):
    """Trace the beam’s path and return segments and activated targets."""
    # Find source
    for row in range(GRID_HEIGHT):
        for col in range(GRID_WIDTH):
            if fixed_grid[row][col].startswith('source_'):
                source_row, source_col = row, col
                source_direction = fixed_grid[row][col][7:]
                break
    
    queue = [(source_row, source_col, source_direction, 'white')]
    beam_lines = []
    activated_targets = set()
    visited = set()
    
    while queue:
        current_row, current_col, direction, color = queue.pop(0)
        if (current_row, current_col, direction, color) in visited:
            continue
        visited.add((current_row, current_col, direction, color))
        
        dx, dy = DIRECTIONS[direction]
        next_row = current_row + dy
        next_col = current_col + dx
        
        if not (0 <= next_row < GRID_HEIGHT and 0 <= next_col < GRID_WIDTH):
            continue
        
        beam_lines.append(((current_col + 0.5, current_row + 0.5), (next_col + 0.5, next_row + 0.5), color))
        fixed = fixed_grid[next_row][next_col]
        player = player_grid[next_row][next_col]
        
        if fixed == 'wall':
            continue
        elif fixed.startswith('target_'):
            required_color = fixed[7:]
            if color == required_color:
                activated_targets.add((next_row, next_col))
            queue.append((next_row, next_col, direction, color))
        elif fixed == 'empty':
            if player == 'empty':
                queue.append((next_row, next_col, direction, color))
            elif player in ['mirror_slash', 'mirror_backslash']:
                new_direction = reflect(direction, player[-1])
                queue.append((next_row, next_col, new_direction, color))
            elif player == 'prism':
                if color == 'white':
                    queue.append((next_row, next_col, direction, 'green'))
                    queue.append((next_row, next_col, turn_left(direction), 'red'))
                    queue.append((next_row, next_col, turn_right(direction), 'blue'))
                else:
                    queue.append((next_row, next_col, direction, color))
            elif player.startswith('filter_'):
                filter_color = player[7:]
                if color == filter_color:
                    queue.append((next_row, next_col, direction, color))
    
    return beam_lines, activated_targets

def draw_item(rect, item_type):
    """Draw a tool’s icon in the UI."""
    x, y, w, h = rect
    if item_type == 'mirror_slash':
        pygame.draw.line(screen, BLACK, (x, y + h), (x + w, y), 3)
    elif item_type == 'mirror_backslash':
        pygame.draw.line(screen, BLACK, (x, y), (x + w, y + h), 3)
    elif item_type == 'prism':
        pygame.draw.polygon(screen, BLACK, [(x + w//2, y), (x, y + h), (x + w, y + h)])
    elif item_type.startswith('filter_'):
        color = COLOR_MAP[item_type[7:]]
        pygame.draw.rect(screen, color, (x, y, w, h))

# Initialize Pygame
pygame.init()
screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
pygame.display.set_caption('Light Weaver')
clock = pygame.time.Clock()
font = pygame.font.Font(None, 24)

# Level setup
fixed_grid = [['empty' for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
fixed_grid[0][5] = 'source_down'  # Source at row 0, col 5, emitting down
fixed_grid[3][4] = 'target_red'   # Target at row 3, col 4, needs red
player_grid = [['empty' for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
available_items = {
    'mirror_slash': 2,
    'mirror_backslash': 2,
    'prism': 1,
    'filter_red': 1,
    'filter_green': 1,
    'filter_blue': 1
}

# UI setup
button_width, button_height = 60, 60
spacing = 20
start_x = (WINDOW_WIDTH - (6 * button_width + 5 * spacing)) // 2
button_positions = [(start_x + i * (button_width + spacing), GRID_HEIGHT * CELL_SIZE + 20, button_width, button_height) for i in range(6)]

# Game loop
running = True
selected_item = None
while running:
    for event in pygame.event.get():
        if event.type == QUIT:
            running = False
        elif event.type == MOUSEBUTTONDOWN:
            if event.button == 1:  # Left click
                # UI click
                for i, rect in enumerate(button_positions):
                    if rect[0] <= event.pos[0] < rect[0] + rect[2] and rect[1] <= event.pos[1] < rect[1] + rect[3]:
                        selected_item = ITEM_TYPES[i]
                        break
                else:
                    # Grid click
                    col = event.pos[0] // CELL_SIZE
                    row = event.pos[1] // CELL_SIZE
                    if 0 <= row < GRID_HEIGHT and 0 <= col < GRID_WIDTH:
                        if fixed_grid[row][col] == 'empty' and player_grid[row][col] == 'empty' and selected_item and available_items[selected_item] > 0:
                            player_grid[row][col] = selected_item
                            available_items[selected_item] -= 1
            elif event.button == 3:  # Right click
                col = event.pos[0] // CELL_SIZE
                row = event.pos[1] // CELL_SIZE
                if 0 <= row < GRID_HEIGHT and 0 <= col < GRID_WIDTH and player_grid[row][col] != 'empty':
                    item_type = player_grid[row][col]
                    player_grid[row][col] = 'empty'
                    available_items[item_type] += 1

    # Trace beam
    beam_lines, activated_targets = trace_beam(fixed_grid, player_grid)

    # Draw
    screen.fill(WHITE)
    # Grid
    for row in range(GRID_HEIGHT):
        for col in range(GRID_WIDTH):
            rect = (col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            if fixed_grid[row][col] == 'empty':
                pygame.draw.rect(screen, GRAY, rect)
            elif fixed_grid[row][col] == 'wall':
                pygame.draw.rect(screen, DARK_GRAY, rect)
            elif fixed_grid[row][col].startswith('source_'):
                pygame.draw.rect(screen, YELLOW, rect)
            elif fixed_grid[row][col].startswith('target_'):
                color = COLOR_MAP[fixed_grid[row][col][7:]]
                pygame.draw.circle(screen, color, (col * CELL_SIZE + CELL_SIZE // 2, row * CELL_SIZE + CELL_SIZE // 2), CELL_SIZE // 3)
            if player_grid[row][col] != 'empty':
                if player_grid[row][col] == 'mirror_slash':
                    pygame.draw.line(screen, BLACK, (col * CELL_SIZE, row * CELL_SIZE + CELL_SIZE), (col * CELL_SIZE + CELL_SIZE, row * CELL_SIZE), 3)
                elif player_grid[row][col] == 'mirror_backslash':
                    pygame.draw.line(screen, BLACK, (col * CELL_SIZE, row * CELL_SIZE), (col * CELL_SIZE + CELL_SIZE, row * CELL_SIZE + CELL_SIZE), 3)
                elif player_grid[row][col] == 'prism':
                    pygame.draw.polygon(screen, BLACK, [(col * CELL_SIZE + CELL_SIZE // 2, row * CELL_SIZE), (col * CELL_SIZE, row * CELL_SIZE + CELL_SIZE), (col * CELL_SIZE + CELL_SIZE, row * CELL_SIZE + CELL_SIZE)])
                elif player_grid[row][col].startswith('filter_'):
                    color = COLOR_MAP[player_grid[row][col][7:]]
                    pygame.draw.rect(screen, color, rect, 5)
    for i in range(GRID_WIDTH + 1):
        pygame.draw.line(screen, BLACK, (i * CELL_SIZE, 0), (i * CELL_SIZE, GRID_HEIGHT * CELL_SIZE))
    for j in range(GRID_HEIGHT + 1):
        pygame.draw.line(screen, BLACK, (0, j * CELL_SIZE), (WINDOW_WIDTH, j * CELL_SIZE))
    # Beam
    for line in beam_lines:
        start = (line[0][0] * CELL_SIZE, line[0][1] * CELL_SIZE)
        end = (line[1][0] * CELL_SIZE, line[1][1] * CELL_SIZE)
        pygame.draw.line(screen, COLOR_MAP[line[2]], start, end, 3)
    # UI
    for i, item_type in enumerate(ITEM_TYPES):
        rect = button_positions[i]
        pygame.draw.rect(screen, GRAY, rect)
        draw_item(rect, item_type)
        text = font.render(str(available_items[item_type]), True, BLACK)
        screen.blit(text, (rect[0] + 10, rect[1] + 10))
        if selected_item == item_type:
            pygame.draw.rect(screen, RED, rect, 3)

    # Check win condition
    all_targets = {(r, c) for r in range(GRID_HEIGHT) for c in range(GRID_WIDTH) if fixed_grid[r][c].startswith('target_')}
    if activated_targets == all_targets:
        print("Level completed!")

    pygame.display.flip()
    clock.tick(60)

pygame.quit()