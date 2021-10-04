const SCALE = 2;

function is_point_in_area(point, area) {
    return (
        point[0] > area[0] &&
        point[0] < area[0] + area[2] &&
        point[1] > area[1] &&
        point[1] < area[1] + area[3]
    );
}

function load_asset(asset_name) {
    let img = new Image();
    img.src = "assets/" + asset_name;
    return img;
}

class Animation {
    constructor(asset_filename, position, frames_metadata) {
        this.asset = load_asset(asset_filename);
        this.frames_metadata = frames_metadata;
        this.state = 0;
        this.timeout = this.frames_metadata.duration;
        this.position = position;
    }

    draw(ctx, dt) {
        ctx.imageSmoothingEnabled = false;
        let frame = this.frames_metadata.frames[this.state];
        ctx.drawImage(
            this.asset,
            frame['x'], frame['y'],
            frame['w'], frame['h'],
            this.position[0], this.position[1],
            frame['w'], frame['h']
        );
        this.timeout -= dt;
        if (this.timeout <= 0) {
            this.state = (this.state + 1) % this.frames_metadata.frames.length;
            this.timeout = this.frames_metadata.duration;
        }
    }
}

class Screen {
    constructor(canvas, fullscreen, show_fps=false) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.views = new Array();
        this.show_fps = show_fps;

        if (fullscreen) {
            let body = document.body;
            let fit_screen_on_page_size = () => {
                let html = document.documentElement;
                let height = Math.max(
                    body.scrollHeight, body.offsetHeight, 
                    html.clientHeight, html.scrollHeight, html.offsetHeight
                );
                this.canvas.width = document.body.clientWidth;
                this.canvas.height = height;
            };
            fit_screen_on_page_size();
            body.onresize = fit_screen_on_page_size;
        }

        this.canvas.onclick = (e) => { this.handle_onclick(e); };
    }

    width() {
        return this.canvas.width;
    }

    height() {
        return this.canvas.height;
    }

    run() {
        let last_time = Date.now();
        let runloop = () => {
            let dt = Date.now() - last_time
            last_time = Date.now();

            this._runloop(dt);
        }
        setInterval(runloop, 1000./60.);
    }

    add_view(view, position) {
        this.views.push({
            contents: view,
            position: position
        });
    }

    _runloop(dt) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let view_data of this.views) {
            let view = view_data.contents;
            this.ctx.save();
            this.ctx.translate(
                (this.width() - view.width()) / 2.,
                (this.height() - view.height()) / 2.
            );
            view.draw(this.ctx, dt);
            this.ctx.restore();    
        }
    }

    handle_onclick(e) {
        let point = [e.clientX, e.clientY];
        for (let view_data of this.views) {
            let view = view_data.contents;
            let view_position = view_data.position;
            if (view_position == 'center') {
                view_position = [
                    (this.width() - view.width()) / 2.,
                    (this.height() - view.height()) / 2.
                ];
            }

            let area = [view_position[0], view_position[1], view.width(), view.height()];
            if (is_point_in_area(point, area)) {
                view.handle_onclick(e, view_position);
            }
        }
    }
}

class PotionView {
    constructor(potion, position) {
        this.potion = potion;
        this.asset = load_asset("potion.png");
        this.position = position;

        this.sprinkles_animation = new Animation('sprinkles.png', [position[0], position[1]], {
            duration: 120.,
            frames: [
                { "x": 0, "y": 0, "w": 28, "h": 43 },
                { "x": 28, "y": 0, "w": 28, "h": 43 },
                { "x": 56, "y": 0, "w": 28, "h": 43 },
                { "x": 84, "y": 0, "w": 28, "h": 43 },
                { "x": 112, "y": 0, "w": 28, "h": 43 },
                { "x": 140, "y": 0, "w": 28, "h": 43 },
                { "x": 168, "y": 0, "w": 28, "h": 43 },
                { "x": 196, "y": 0, "w": 28, "h": 43 }
            ]
        });

        this.time = 0.0;
        this.velocity = 0.0;

        this.LIQ_OFFSET = [6, 31];
        this.LIQ_CONTENT_SIZE = [6, 5];
    }

    draw(ctx, dt) {
        ctx.save();
        if (this.potion.is_selected) {
            ctx.translate(0, -5);
        }

        if (this.potion.is_closed()) {
            dt = Math.max(Math.min(dt, 17), 15);
            this.position[1] += this.velocity * dt;
            this.velocity = Math.sin(this.time / 80) / 40;
            this.time += dt;
        }

        ctx.drawImage(this.asset, this.position[0], this.position[1]);
        this._draw_contents(ctx);

        if (this.potion.is_closed()) {
            this.sprinkles_animation.draw(ctx, dt);
        }

        ctx.restore();
    }

    _get_color_from_id(id) {
        if (id == 1) {
            return "rgb(80, 80, 150)";
        } else if (id == 2) {
            return "rgb(150, 50, 50)";
        } else if (id == 3) {
            return "rgb(50, 150, 50)";
        } else if (id == 4) {
            return "rgb(200, 200, 0)";
        }
        return "rgb(255, 255, 255)";
    }

    _draw_contents(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        for (let i = 0; i < 4; ++i) {
            let liq_id = this.potion.contents[i];
            if (liq_id == 0) {
                continue;
            }
            ctx.fillStyle = this._get_color_from_id(liq_id);
            ctx.fillRect(
                this.position[0] + this.LIQ_OFFSET[0],
                this.position[1] + this.LIQ_OFFSET[1] - i * this.LIQ_CONTENT_SIZE[1],
                this.LIQ_CONTENT_SIZE[0],
                this.LIQ_CONTENT_SIZE[1]
            );
        }
        ctx.restore();
    }
}

class PotionsGameView {
    constructor(game_model) {
        this._width = 400;
        this._height = 300;
        this.game_model = game_model;

        this.potion_views = [];
        let padding = 3;
        let margin = 35;
        let margin_bottom = 50;
        for (let i = 0; i < 3; ++i) {
            for (let j = 0; j < 6; ++j) {
                let potion = this.game_model.potions[6 * i + j];
                let position = [
                    j * margin + padding,
                    i * margin_bottom + padding
                ];
                this.potion_views.push(new PotionView(potion, position));
            }
        }
    }

    width() {
        return this._width;
    }

    height() {
        return this._height;
    }

    draw(ctx, dt) {
        ctx.fillStyle = "rgb(60, 40, 40)";
        ctx.fillRect(0, 0, this.width(), this.height());

        ctx.scale(SCALE, SCALE);
        ctx.imageSmoothingEnabled = false;
        for (let potion_view of this.potion_views) {
            potion_view.draw(ctx, dt);
        }
    }

    handle_onclick(e, draw_position) {
        let dx = draw_position[0] / SCALE;
        let dy = draw_position[1] / SCALE;

        let padding = 3;
        let margin = 35;
        let margin_bottom = 50;

        let point = [e.clientX, e.clientY];
        for (let i = 0; i < 3; ++i) {
            for (let j = 0; j < 6; ++j) {
                let area = [
                    (j * margin + padding + dx) * SCALE,
                    (i * margin_bottom + padding + dy) * SCALE,
                    18 * SCALE,
                    43 * SCALE
                ];

                if (is_point_in_area(point, area)) {
                    let clicked_potion = this.game_model.potions[6 * i + j];
                    if (clicked_potion.is_closed()) {
                        continue;
                    }

                    let active_potion = this.game_model.get_selected_potion();
                    if (active_potion == null) {
                        this.game_model.set_selected_potion(clicked_potion);
                    } else {
                        if (active_potion != clicked_potion) {
                            this.game_model.move_contents(active_potion, clicked_potion);
                        }
                        this.game_model.set_selected_potion(null);
                    }
                }
            }
        }
    }
}

class Potion {
    constructor() {
        this.contents = this._generate_random_initial_liq();
        this.is_selected = false;
    }

    is_closed() {
        if (this.contents.length != 4) {
            return false;
        }

        return (
            this.contents[0] == this.contents[1] &&
            this.contents[1] == this.contents[2] &&
            this.contents[2] == this.contents[3]
        )
    }

    _generate_random_initial_liq() {
        let liquids = [];
        for (let i = 0; i < 4; ++i) {
            let c = Math.floor(Math.random() * 4);
            if (c == 0) {
                break;
            }
            liquids.push(c);
        }
        return liquids;
    }
};

class PotionsGameModel {
    constructor(n_potions) {
        this.potions = new Array();
        for (let i = 0; i < n_potions; ++i) {
            this.potions.push(new Potion());
        }
        this.selected_potion = null;
    }

    set_selected_potion(potion) {
        if (this.selected_potion != null) {
            this.selected_potion.is_selected = false;
        }

        if (this.selected_potion == potion) {
            this.selected_potion = null;
        } else {
            this.selected_potion = potion;
            if (this.selected_potion != null) {
                this.selected_potion.is_selected = true;
            }
        }
    }

    get_selected_potion() {
        return this.selected_potion;
    }

    move_contents(from_potion, to_potion) {
        if (from_potion.contents.length == 0) {
            // Invalid move
            return;
        }

        if (from_potion.is_closed() || to_potion.is_closed()) {
            // Invalid move
            return;
        }

        let from_top_content = from_potion.contents[from_potion.contents.length - 1];
        let to_top_content = to_potion.contents[to_potion.contents.length - 1];
        if (to_top_content != undefined && from_top_content != to_top_content) {
            // Invalid move
            return;
        }

        while (
            from_potion.contents.length > 0 &&
            to_potion.contents.length < 4 &&
            from_potion.contents[from_potion.contents.length - 1] == from_top_content
        ) {
            to_potion.contents.push(from_potion.contents.pop());
        }
    }
}

window.onload = function() {
    let game_model = new PotionsGameModel(18);
    let screen = new Screen(document.getElementById('screen'), fullscreen=true);
    let game_view = new PotionsGameView(game_model);
    screen.add_view(game_view, position='center');
    screen.run();
}
